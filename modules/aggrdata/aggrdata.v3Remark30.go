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
	data       map[string]float64
	tablename  string
	alldata    = toolkit.M{}
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
	data = make(map[string]float64)
	flag.IntVar(&fiscalyear, "year", 2015, "YYYY representation of godrej fiscal year. Default is 2015")
	// flag.StringVar(&tablename, "table", "salespls-2015", "representation of tablename we used")
	flag.Parse()

	tablename = toolkit.Sprintf("salespls-%d", fiscalyear)

	setinitialconnection()
	defer gdrj.CloseDb()

	toolkit.Println("Preparing data query...")

	eperiode := time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	speriode := eperiode.AddDate(-1, 0, 0)
	speriode = eperiode.AddDate(0, 0, -10)

	seeds := make([]time.Time, 0, 0)
	seeds = append(seeds, speriode)
	for {
		speriode = speriode.AddDate(0, 0, 1)
		if !speriode.Before(eperiode) {
			break
		}
		seeds = append(seeds, speriode)
	}

	toolkit.Println("Starting worker query...")
	result := make(chan toolkit.M, len(seeds))
	filterchan := make(chan *dbox.Filter, len(seeds))
	for i := 0; i < 30; i++ {
		go workerproc(i, filterchan, result)
	}

	for _, v := range seeds {
		filterchan <- dbox.Eq("date.date", v)
	}
	close(filterchan)

	step := len(seeds) / 100
	if step == 0 {
		step = 1
	}
	// "date.fiscal","date.quartertxt","date.month", "customer.branchname", "customer.keyaccount",
	// "customer.channelid", "customer.channelname", "customer.reportchannel", "customer.reportsubchannel",
	// "customer.zone", "customer.region", "customer.areaname","product.brand"
	toolkit.Println("Waiting result query...")
	for i := 1; i <= len(seeds); i++ {
		a := <-result
		for k, v := range a {
			lasttkm := toolkit.M{}
			newtkm, _ := toolkit.ToM(v)
			if alldata.Has(k) {
				lasttkm = alldata[k].(toolkit.M)
			}

			for tk, tv := range newtkm {
				df := toolkit.ToFloat64(tv, 6, toolkit.RoundingAuto) + lasttkm.GetFloat64(tk)
				lasttkm.Set(tk, df)
			}
			alldata.Set(k, lasttkm)
		}

		if i%step == 0 {
			toolkit.Printfn("Day %d of %d (%d), Done in %s",
				i, len(seeds), (i / step), time.Since(t0).String())
		}
	}

	// listdimension := []string{"date.fiscal,customer.channelid,customer.channelname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.reportsubchannel",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.zone",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.areaname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.region",
	// 	"date.fiscal,customer.branchname",
	// 	"date.fiscal,product.brand",
	// 	"date.fiscal,customer.zone",
	// 	"date.fiscal,customer.areaname",
	// 	"date.fiscal,customer.region",
	// 	"date.fiscal,customer.keyaccount",
	// 	"date.fiscal,date.month,customer.channelid,customer.channelname",
	// 	"date.fiscal,date.month,customer.branchname",
	// 	"date.fiscal,date.month,customer.brand",
	// 	"date.fiscal,date.month,customer.areaname",
	// 	"date.fiscal,date.month,customer.region",
	// 	"date.fiscal,date.month,customer.keyaccount",
	// 	"date.fiscal,date.quartertxt,customer.channelid,customer.channelname",
	// 	"date.fiscal,date.quartertxt,customer.branchname",
	// 	"date.fiscal,date.quartertxt,product.brand",
	// 	"date.fiscal,date.quartertxt,customer.areaname",
	// 	"date.fiscal,date.quartertxt,customer.region",
	// 	"date.fiscal,date.quartertxt,customer.keyaccount",
	// 	"date.fiscal,customer.reportchannel,customer.reportsubchannel",
	// 	"date.fiscal,customer.customergroupname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.branchname",
	// 	"date.fiscal,customer.channelid,customer.channelname,customer.reportsubchannel"}

	listdimension := []string{"date.fiscal,customer.channelid,customer.channelname"}
	// "date.fiscal,customer.branchname",
	// "date.fiscal,product.brand",
	// "date.fiscal,customer.zone",
	// "date.fiscal,customer.areaname",
	// "date.fiscal,customer.reportchannel,customer.reportsubchannel",
	// "date.fiscal,customer.reportchannel,customer.reportsubchannel,customer.branchname"}

	resdimension := make(chan int, len(listdimension))
	dimension := make(chan string, len(listdimension))

	for i := 0; i < 3; i++ {
		go workerbuilddimension(i, dimension, resdimension)
	}

	toolkit.Printfn("Prepare saving collection, Create dimension")
	for _, str := range listdimension {
		dimension <- str
		// toolkit.Printfn("SEND : %v", str)
	}
	close(dimension)

	toolkit.Printfn("Waiting dimension result")
	for i := 0; i < len(listdimension); i++ {
		<-resdimension
		toolkit.Printfn("%v Dimension created", i)
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

func workerproc(wi int, filters <-chan *dbox.Filter, result chan<- toolkit.M) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()
	tkm := toolkit.M{}
	// "date.fiscal","date.quartertxt","date.month", "customer.branchname", "customer.keyaccount",
	// "customer.channelid", "customer.channelname", "customer.reportchannel", "customer.reportsubchannel",
	// "customer.zone", "customer.region", "customer.areaname","product.brand"
	filter := new(dbox.Filter)
	for filter = range filters {
		csr, _ := workerconn.NewQuery().Select("date", "customer", "product.brand", "pldatas").
			From(tablename).
			Where(filter).
			Cursor(nil)

		scount := csr.Count()
		step := scount / 100

		if step == 0 {
			step = 1
		}

		strmonthdate := ""
		for {
			spl := new(gdrj.SalesPL)
			e := csr.Fetch(spl, 1, false)
			if e != nil {
				break
			}
			//"date.fiscal", "customer.channelid", "customer.channelname"
			// key := toolkit.Sprintf("%s|%s|%d|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s", spl.Date.Fiscal, spl.Date.QuarterTxt, spl.Date.Month,
			// 	spl.Customer.BranchName, spl.Customer.KeyAccount, spl.Customer.ChannelID, spl.Customer.ChannelName,
			// 	spl.Customer.ReportChannel, spl.Customer.ReportSubChannel, spl.Customer.Zone, spl.Customer.Region,
			// 	spl.Customer.AreaName, spl.Product.Brand)

			key := toolkit.Sprintf("%s|%s|%s", spl.Date.Fiscal, spl.Customer.ChannelID, spl.Customer.ChannelName)
			strmonthdate = toolkit.Sprintf("%d-%d-%d", spl.Date.Year, spl.Date.Month, spl.Date.Date.Day())

			dtkm := toolkit.M{}
			if tkm.Has(key) {
				dtkm = tkm[key].(toolkit.M)
			}

			tv := spl.GrossAmount + dtkm.GetFloat64("grossamount")
			dtkm.Set("grossamount", tv)

			tv = spl.NetAmount + dtkm.GetFloat64("netamount")
			dtkm.Set("netamount", tv)

			tv = spl.DiscountAmount + dtkm.GetFloat64("discountamount")
			dtkm.Set("discountamount", tv)

			tv = spl.SalesQty + dtkm.GetFloat64("salesqty")
			dtkm.Set("salesqty", tv)

			for k, v := range spl.PLDatas {
				tv := v.Amount + dtkm.GetFloat64(k)
				dtkm.Set(k, tv)
			}

			tkm.Set(key, dtkm)

		}

		result <- tkm
		csr.Close()
		toolkit.Printfn("Send %s", strmonthdate)
	}
}

func workerbuilddimension(wi int, dimension <-chan string, resdimension chan<- int) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()
	//"date.fiscal", "customer.channelid", "customer.channelname"

	// sortkeys := []string{"date.fiscal", "date.quartertxt", "date.month",
	// 	"customer.branchname", "customer.keyaccount", "customer.channelid", "customer.channelname", "customer.reportchannel",
	// 	"customer.reportsubchannel", "customer.zone", "customer.region", "customer.areaname", "product.brand"}

	sortkeys := []string{"date.fiscal", "customer.channelid", "customer.channelname"}

	str := ""
	for str = range dimension {
		// toolkit.Println(str)
		payload := new(gdrj.PLFinderParam)
		payload.Breakdowns = strings.Split(str, ",")
		tablename01 := toolkit.Sprintf("1-%v", payload.GetTableName())

		tkm := toolkit.M{}
		for key, val := range alldata {
			// toolkit.Printfn("%s", key)
			arrkey := strings.Split(key, "|")
			// toolkit.Printfn("%d - %d", len(sortkeys), len(arrkey))
			dkey := ""
			for i, v := range sortkeys {
				for _, vx := range payload.Breakdowns {
					if vx == v {
						if len(dkey) > 0 {
							dkey = toolkit.Sprintf("%s|%s", dkey, arrkey[i])
						} else {
							dkey = arrkey[i]
						}
					}
				}
			}

			stkm, _ := toolkit.ToM(val)
			dtkm := toolkit.M{}
			if tkm.Has(dkey) {
				dtkm = tkm[dkey].(toolkit.M)
			}

			for k, v := range stkm {
				fv := toolkit.ToFloat64(v, 6, toolkit.RoundingAuto) + dtkm.GetFloat64(k)
				dtkm.Set(k, fv)
			}

			tkm.Set(dkey, dtkm)
		}

		i := 0

		for k, v := range tkm {
			i++
			a, _ := toolkit.ToM(v)
			id := toolkit.M{}
			arrk := strings.Split(k, "|")
			for ix, sv := range payload.Breakdowns {
				tsv := strings.Replace(sv, ".", "_", -1)
				id.Set(tsv, "")
				if len(arrk) > ix {
					id.Set(tsv, arrk[ix])
				}
			}

			a.Set("_id", k)
			a.Set("key", id)

			_ = workerconn.NewQuery().
				From(tablename01).
				SetConfig("multiexec", true).
				Save().Exec(toolkit.M{}.Set("data", a))
		}

		toolkit.Printfn("Saved dimension %v, %d rows", str, len(tkm))

		resdimension <- len(tkm)
	}
}
