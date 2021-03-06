package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"flag"
	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
	"strings"
	//"sync"
	"time"
)

var conn dbox.IConnection
var count int

// var mwg sync.WaitGroup

var (
	t0                                 time.Time
	custgroup, prodgroup, plcode, ref  string
	value, fiscalyear, iscount, scount int
	globalval                          float64
	mapsperiod                         map[string]float64
	mapkeysvalue                       map[string]float64
	masters                            toolkit.M
	//mwg                                sync.WaitGroup
)

func setinitialconnection() {
	var err error
	conn, err = modules.GetDboxIConnection("db_godrej")

	if err != nil {
		toolkit.Println("Initial connection found : ", err)
		os.Exit(1)
	}

	err = gdrj.SetDb(conn)
	if err != nil {
		toolkit.Println("Initial connection found : ", err)
		os.Exit(1)
	}
}

func buildmap(holder interface{},
	fnModel func() orm.IModel,
	filter *dbox.Filter,
	fnIter func(holder interface{}, obj interface{})) interface{} {
	crx, _ := gdrj.Find(fnModel(), filter, nil)
	defer crx.Close()
	for {
		s := fnModel()
		e := crx.Fetch(s, 1, false)
		if e != nil {
			break
		}
		fnIter(holder, s)
	}
	return holder
}

func prepmaster() {
	masters = toolkit.M{}

	masters.Set("plmodel", buildmap(map[string]*gdrj.PLModel{},
		func() orm.IModel {
			return new(gdrj.PLModel)
		},
		nil,
		func(holder, obj interface{}) {
			h := holder.(map[string]*gdrj.PLModel)
			o := obj.(*gdrj.PLModel)
			h[o.ID] = o
		}).(map[string]*gdrj.PLModel))

	ccs := buildmap(map[string]*gdrj.CostCenter{},
		func() orm.IModel {
			return new(gdrj.CostCenter)
		},
		nil,
		func(holder, obj interface{}) {
			h := holder.(map[string]*gdrj.CostCenter)
			o := obj.(*gdrj.CostCenter)
			h[o.ID] = o
		}).(map[string]*gdrj.CostCenter)
	masters.Set("costcenter", ccs)
}

var plmodels map[string]*gdrj.PLModel

func main() {
	t0 = time.Now()
	mapkeysvalue = make(map[string]float64)
	mapsperiod = make(map[string]float64)
	flag.IntVar(&fiscalyear, "year", 2015, "YYYY representation of godrej fiscal year. Default is 2015")
	flag.StringVar(&ref, "ref", "", "Reference from document or other. Default is blank")
	flag.Parse()

	eperiode := time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	speriode := eperiode.AddDate(-1, 0, 0)

	// if plcode == "" || value == 0 {
	// 	toolkit.Println("PLCode and Value are mandatory to fill")
	// 	os.Exit(1)
	// }

	setinitialconnection()
	defer gdrj.CloseDb()

	toolkit.Println("Get Data Master...")
	prepmaster()

	toolkit.Println("Count SGA Data Process...")
	// conn, _ = modules.GetDboxIConnection("db_godrej")
	conn, _ := modules.GetDboxIConnection("db_godrej")
	csga, _ := conn.NewQuery().Select().From("tmpsgaallocs").Cursor(nil)
	defer csga.Close()
	defer conn.Close()

	i := 0
	ssga := csga.Count()
	ccs := masters.Get("costcenter").(map[string]*gdrj.CostCenter)
	for {

		i++
		tsga := toolkit.M{}
		e := csga.Fetch(&tsga, 1, false)
		if e != nil {
			break
		}

		date := time.Date(tsga.Get("y", 0).(int), time.Month(tsga.Get("p", 0).(int)), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 4, 0)
		pval := toolkit.Sprintf("%d_%d", date.Year(), int(date.Month()))

		group := ""
		tcc, exist := ccs[tsga.Get("ccid", "").(string)]
		if exist {
			group = tcc.CostGroup01
		}

		if group == "" {
			group = "Other"
		}

		kval := toolkit.Sprintf("%v_%v", pval, group)
		mapkeysvalue[kval] += toolkit.ToFloat64(tsga.Get("amount", 0), 6, toolkit.RoundingAuto)
		mapsperiod[pval] += toolkit.ToFloat64(tsga.Get("amount", 0), 6, toolkit.RoundingAuto)

		if ssga%500 == 0 {
			toolkit.Printfn("Prepare sga master %d of %d in %s",
				i, ssga,
				time.Since(t0).String())
		}

	}

	toolkit.Println("Start Data Process...")
	filter := dbox.And(dbox.Gte("date.date", speriode), dbox.Lt("date.date", eperiode), dbox.Gt("skuid_vdist", ""))
	filter = dbox.Eq("_id","CN/IDM/15000008_4")
	c, _ := gdrj.Find(new(gdrj.SalesPL), filter, nil)
	defer c.Close()

	scount = c.Count()
	iscount = 0
	step := scount / 100
	i = 0

	jobs := make(chan *gdrj.SalesPL, count)
	result := make(chan string, count)

	toolkit.Println("Prepare Worker")
	for wi := 0; wi < 10; wi++ {
		//mwg.Add(1)
		go worker(wi, jobs, result)
	}

	plmodels = masters.Get("plmodel").(map[string]*gdrj.PLModel)
	for {
		i++

		spl := new(gdrj.SalesPL)
		e := c.Fetch(spl, 1, false)
		if e != nil {
			toolkit.Println("EOF")
			break
		}
		
		jobs <- spl
		if i > step {
			step += scount / 100
			toolkit.Printfn("Processing %d of %d in %s", i, scount,
				time.Since(t0).String())
		}

	}

	close(jobs)
	//mwg.Wait()

	for i:=0;i<count;i++{
		<-result
		toolkit.Printfn("Saving %d of %d in %s", i, scount,
				time.Since(t0).String())
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

// func getcursorsga() (dbox.ICursor, error) {
// 	conn, _ := modules.GetDboxIConnection("db_godrej")
// 	defer conn.Close()

// 	c, e := conn.NewQuery().Select().From("tmpsgaallocs").Cursor(nil)
// 	return c, e
// }

func worker(wi int, jobs <-chan *gdrj.SalesPL, result chan<- string) {
	workerConn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerConn.Close()
	//defer mwg.Done()

	var spl *gdrj.SalesPL
	table := spl.TableName()

	for spl = range jobs {
		aplmodel := spl.PLDatas
		for k, _ := range aplmodel {
			if strings.Contains(k, "PL33") || strings.Contains(k, "PL34") || strings.Contains(k, "PL35") {
				aplmodel[k] = nil
			}
		}

		spl.PLDatas = aplmodel

		key := toolkit.Sprintf("%d_%d", spl.Date.Year, int(spl.Date.Month))

		totsgaperiod, _ := mapsperiod[key]
		totsgaline := spl.RatioToGlobalSales * totsgaperiod

		for k, v := range mapkeysvalue {
			skey := strings.Split(k, "_")
			if toolkit.ToInt(skey[0], toolkit.RoundingAuto) != spl.Date.Year || toolkit.ToInt(skey[1], toolkit.RoundingAuto) != int(spl.Date.Month) {
				continue
			}

			spl.AddDataCC("PL33", (-totsgaline*v/totsgaperiod)*0.7, skey[2], plmodels)
			spl.AddDataCC("PL34", (-totsgaline*v/totsgaperiod)*0.26, skey[2], plmodels)
			spl.AddDataCC("PL35", (-totsgaline*v/totsgaperiod)*0.04, skey[2], plmodels)

		}

		spl.CalcSum(masters)

		e := workerConn.NewQuery().From(table).
			Save().Exec(toolkit.M{}.Set("data", spl))
		if e!=nil {
			toolkit.Printfn("Unable to save %s = %s",
				spl.ID, e.Error())
			os.Exit(200)
		} 
		iscount++
		if iscount%100000 == 0 {
			toolkit.Printfn("Saved %d of %d in %s",
				iscount, scount,
				time.Since(t0).String())
		}
		result <- ""
	}
}
