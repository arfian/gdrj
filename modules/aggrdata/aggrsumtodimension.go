package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"flag"
	"strings"

	"github.com/eaciit/dbox"
	"github.com/eaciit/toolkit"
	// "sync"
	"time"
)

var conn dbox.IConnection
var count int

var (
	t0         time.Time
	fiscalyear int
	tablename  string
	alldata    []toolkit.M
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

func main() {
	t0 = time.Now()
	alldata = make([]toolkit.M, 0, 0)
	flag.IntVar(&fiscalyear, "year", 2015, "YYYY representation of godrej fiscal year. Default is 2015")
	flag.Parse()
	tablename = "salespls-summary"

	setinitialconnection()
	defer gdrj.CloseDb()

	toolkit.Println("Preparing data query...")
	//key.date_fiscal
	csr, _ := conn.NewQuery().Select().
		From("salespls-summary").
		Where(dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))).
		Cursor(nil)

	defer csr.Close()
	for {
		tkm := toolkit.M{}

		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			break
		}

		alldata = append(alldata, tkm)
	}

	toolkit.Printfn("Buffered alldata, %d rows in %s", len(alldata), time.Since(t0).String())

	//LIST01
	// listdimension := []string{
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.areaname,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.branchname,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.zone,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.region,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,product.brand,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.areaname,customer.customergroupname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.areaname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.branchname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.zone",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.region",
	// 	"date.fiscal,customer.channelid,customer.channelname,product.brand",
	// 	"date.fiscal,customer.keyaccount,customer.customergroupname",
	// 	"date.fiscal,customer.reportchannel,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelname,customer.areaname",
	// 	"date.fiscal,date.month,customer.channelid,customer.channelname",
	// 	"date.fiscal,date.month,customer.branchname",
	// 	"date.fiscal,date.month,customer.brand",
	// 	"date.fiscal,date.month,customer.areaname",
	// 	"date.fiscal,date.month,customer.region",
	// 	"date.fiscal,date.month,customer.keyaccount",
	// 	"date.fiscal,date.quartertxt,customer.branchname",
	// 	"date.fiscal,date.quartertxt,product.brand",
	// 	"date.fiscal,date.quartertxt,customer.areaname",
	// 	"date.fiscal,date.quartertxt,customer.region",
	// 	"date.fiscal,date.quartertxt,customer.keyaccount",
	// 	"date.fiscal,date.quartertxt,customer.channelid,customer.channelname",
	// 	"date.fiscal,customer.channelid,customer.channelname",
	// 	"date.fiscal,customer.channelid", //add
	// 	"date.fiscal,customer.areaname",
	// 	"date.fiscal,customer.branchname",
	// 	"date.fiscal,customer.zone",
	// 	"date.fiscal,customer.region",
	// 	"date.fiscal,customer.keyaccount",
	// 	"date.fiscal,product.brand",
	// 	"date.fiscal,customer.customergroupname",
	// 	"date.fiscal,date.month",
	// 	"date.fiscal,date.quartertxt",
	// }

	listdimension := []string{
		"date.fiscal,customer.channelid,customer.channelname,customer.areaname,customer.reportsubchannel",
		"date.fiscal,customer.channelid,customer.channelname,customer.branchname,customer.reportsubchannel",
		"date.fiscal,customer.channelid,customer.channelname,customer.zone,customer.reportsubchannel",
		"date.fiscal,customer.channelid,customer.channelname,customer.region,customer.reportsubchannel",
		"date.fiscal,customer.channelid,customer.channelname,product.brand,customer.reportsubchannel",
		"date.fiscal,customer.channelid,customer.channelname,customer.areaname,customer.customergroupname", //problem
		"date.fiscal,date.month,date.year,customer.channelid,customer.channelname",
		"date.fiscal,customer.keyaccount,customer.customergroupname",
		"date.fiscal,customer.channelid,customer.channelname,customer.areaname",
		"date.fiscal,customer.channelid,customer.channelname,customer.branchname",
		"date.fiscal,customer.channelid,customer.channelname,customer.zone",
		"date.fiscal,customer.channelid,customer.channelname,customer.region",
		"date.fiscal,customer.channelid,customer.channelname,product.brand",
		"date.fiscal,date.month,customer.channelid,customer.channelname",
		"date.fiscal,customer.reportchannel,customer.reportsubchannel",
		"date.fiscal,customer.channelid,customer.channelname,customer.reportsubchannel",
		"date.fiscal,date.month,customer.branchname",
		"date.fiscal,date.month,customer.brand",
		"date.fiscal,date.month,customer.areaname",
		"date.fiscal,date.month,customer.region",
		"date.fiscal,date.month,customer.keyaccount",
		"date.fiscal,date.quartertxt,customer.channelid,customer.channelname",
		"date.fiscal,date.month,date.year,customer.branchname",
		"date.fiscal,date.month,date.year,customer.brand",
		"date.fiscal,date.month,date.year,customer.areaname",
		"date.fiscal,date.month,date.year,customer.region",
		"date.fiscal,date.month,date.year,customer.keyaccount",
		"date.fiscal,customer.channelname,customer.areaname",
		"date.fiscal,customer.channelid,customer.channelname",
		"date.fiscal,date.quartertxt,customer.branchname",
		"date.fiscal,date.quartertxt,product.brand",
		"date.fiscal,date.quartertxt,customer.areaname",
		"date.fiscal,date.quartertxt,customer.region",
		"date.fiscal,date.quartertxt,customer.keyaccount",
		"date.fiscal,date.month,date.year",
		"date.fiscal,customer.areaname",
		"date.fiscal,customer.branchname",
		"date.fiscal,customer.zone",
		"date.fiscal,customer.region",
		"date.fiscal,customer.keyaccount",
		"date.fiscal,product.brand",
		"date.fiscal,customer.customergroupname",
		"date.fiscal,date.month",
		"date.fiscal,date.quartertxt",
	}

	// comblist := []string{"customer.branchname", "product.brand", "customer.channelname",
	// 	"customer.areaname", "customer.region", "customer.zone", "customer.keyaccount"}

	// for i := 0; i < len(comblist); i++ {
	// 	tarrstr := []string{comblist[i]}
	// 	for ix := i + 1; ix < len(comblist); ix++ {
	// 		tarrstr = append(tarrstr, comblist[ix])

	// 		tstr := strings.Join(tarrstr, ",")
	// 		listdimension = append(listdimension, tstr)
	// 	}
	// }

	toolkit.Printfn("All Dimension : %d", len(listdimension))
	for _, v := range listdimension {
		toolkit.Println(v)
	}
	toolkit.Println()

	resdimension := make(chan int, len(listdimension))
	dimension := make(chan string, len(listdimension))

	for i := 0; i < 10; i++ {
		go workerbuilddimension(i, dimension, resdimension)
	}

	toolkit.Printfn("Prepare saving collection, Create dimension")
	for _, str := range listdimension {
		dimension <- str
	}
	close(dimension)

	toolkit.Printfn("Waiting dimension result")
	for i := 0; i < len(listdimension); i++ {
		<-resdimension
		toolkit.Printfn("%d of %d Dimension created", i+1, len(listdimension))
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

func workerbuilddimension(wi int, dimension <-chan string, resdimension chan<- int) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()

	str := ""
	for str = range dimension {
		payload := new(gdrj.PLFinderParam)
		payload.Breakdowns = strings.Split(str, ",")
		tablename01 := toolkit.Sprintf("%v", payload.GetTableName())

		tkm := toolkit.M{}
		for _, val := range alldata {
			t_id := ""
			key := toolkit.M{}

			tkey, _ := toolkit.ToM(val.Get("key", toolkit.M{}))
			for _, v := range payload.Breakdowns {
				str := strings.Replace(v, ".", "_", -1)
				if t_id == "" {
					t_id = tkey.GetString(str)
				} else {
					t_id = toolkit.Sprintf("%s_%s", t_id, tkey.GetString(str))
				}
				key.Set(str, tkey.GetString(str))
			}

			dtkm := toolkit.M{}
			if tkm.Has(t_id) {
				dtkm = tkm[t_id].(toolkit.M)
			}
			dtkm.Set("key", key)

			for k, v := range val {
				if k == "key" || k == "_id" {
					continue
				}

				fv := toolkit.ToFloat64(v, 6, toolkit.RoundingAuto) + dtkm.GetFloat64(k)
				dtkm.Set(k, fv)
			}

			tkm.Set(t_id, dtkm)
		}

		i := 0
		for k, v := range tkm {
			i++
			a := v.(toolkit.M)

			a.Set("_id", k)
			_ = workerconn.NewQuery().
				From(tablename01).
				SetConfig("multiexec", true).
				Save().Exec(toolkit.M{}.Set("data", a))
		}

		toolkit.Printfn("Saved dimension %v, %d rows", str, len(tkm))

		resdimension <- len(tkm)
	}
}
