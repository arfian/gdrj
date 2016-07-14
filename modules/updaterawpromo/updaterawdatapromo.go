package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"flag"
	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
	// "strings"
	"time"
)

var conn dbox.IConnection
var count int

var (
	t0                          time.Time
	fiscalyear, iscount, scount int
	data                        map[string]float64
	masters                     = toolkit.M{}
)

type sgaalloc struct {
	ChannelID                                    string
	TotalNow, TotalExpect, RatioNow, RatioExpect float64
	TotalSales                                   float64
}

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

func getstep(count int) int {
	v := count / 100
	if v == 0 {
		return 1
	}
	return v
}

func prepmastertargetdatapromo() {
	toolkit.Println("--> Get Data rawdatapl_promotarget")

	// filter := dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	csr, _ := conn.NewQuery().Select().From("rawdatapl_promotarget").Cursor(nil)
	defer csr.Close()

	promotarget := toolkit.M{}

	for {
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			break
		}

		promotarget.Set(tkm.GetString("_id"), tkm)
	}

	masters.Set("promotarget", promotarget)
}

func prepmasteraggrdatapromo() {

	toolkit.Println("--> Get Data rawdatapl_promotarget")

	filter := dbox.Eq("year", fiscalyear-1)
	csr, _ := conn.NewQuery().Select().Where(filter).From("rawdatapl_promospg11072016").Cursor(nil)
	defer csr.Close()
	//promoaggrs := masters.Get("promoaggr").(toolkit.M)
	promoaggr := toolkit.M{}

	for {
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			break
		}
		v := promoaggr.GetFloat64(tkm.GetString("keyaccountcode")) + tkm.GetFloat64("amountinidr")
		promoaggr.Set(tkm.GetString("keyaccountcode"), v)
	}

	masters.Set("promoaggr", promoaggr)
}

func main() {
	t0 = time.Now()
	data = make(map[string]float64)
	flag.IntVar(&fiscalyear, "year", 2015, "YYYY representation of godrej fiscal year. Default is 2015")
	flag.Parse()

	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()

	setinitialconnection()
	defer gdrj.CloseDb()
	prepmastertargetdatapromo()
	prepmasteraggrdatapromo()

	toolkit.Println("Start data query...")
	filter := dbox.Eq("year", fiscalyear-1)
	csr, _ := workerconn.NewQuery().Select().Where(filter).From("rawdatapl_promospg11072016").Cursor(nil)
	defer csr.Close()

	scount = csr.Count()

	jobs := make(chan toolkit.M, scount)
	result := make(chan int, scount)
	for wi := 0; wi < 10; wi++ {
		go workersave(wi, jobs, result)
	}

	iscount = 0
	step := getstep(scount) * 5

	for {
		iscount++
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			toolkit.Println("EOF")
			break
		}

		jobs <- tkm

		if iscount%step == 0 {
			toolkit.Printfn("Sending %d of %d (%d) in %s", iscount, scount, iscount*100/scount,
				time.Since(t0).String())
		}

	}

	close(jobs)

	for ri := 0; ri < scount; ri++ {
		<-result

		if ri%step == 0 {
			toolkit.Printfn("Saving %d of %d (%d pct) in %s",
				ri, scount, ri*100/scount, time.Since(t0).String())
		}
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

func UpdateRawDataPromo(tkm toolkit.M) {
	promotargets := masters.Get("promotarget").(toolkit.M)
	promoaggrs := masters.Get("promoaggr").(toolkit.M)

	promotarget := toolkit.M{}
	if promotargets.Has(tkm.GetString("keyaccountcode")) {
		promotarget = promotargets.Get(tkm.GetString("keyaccountcode")).(toolkit.M)
	}

	val := (tkm.GetFloat64("amountinidr") / promoaggrs.GetFloat64(tkm.GetString("keyaccountcode"))) * promotarget.GetFloat64("target2014")

	tkm.Set("amountinidr_target", val)
}

func workersave(wi int, jobs <-chan toolkit.M, result chan<- int) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()

	qSave := workerconn.NewQuery().
		From("rawdatapl_promospg11072016_target").
		SetConfig("multiexec", true).
		Save()

	trx := toolkit.M{}
	for trx = range jobs {
		UpdateRawDataPromo(trx)

		err := qSave.Exec(toolkit.M{}.Set("data", trx))
		if err != nil {
			toolkit.Println(err)
		}

		result <- 1
	}
}