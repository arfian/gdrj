package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"flag"
	"github.com/eaciit/dbox"
	"github.com/eaciit/toolkit"
	"sync"
	"time"
)

var conn dbox.IConnection
var count int

var (
	t0         time.Time
	fiscalyear int
	data       map[string]float64
	mutex      = &sync.Mutex{}
	tablename  string
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
	flag.StringVar(&tablename, "table", "salespls", "Source Table")
	flag.Parse()

	setinitialconnection()
	defer gdrj.CloseDb()

	toolkit.Println("Preparing data query...")

	eperiode := time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	speriode := eperiode.AddDate(-1, 0, 0)

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
	for i, v := range seeds {
		filter := dbox.Eq("date.date", v)
		go workerproc(i, filter, result)
	}

	step := len(seeds) / 100
	if step == 0 {
		step = 1
	}

	toolkit.Println("Waiting result query...")
	for i := 1; i <= len(seeds); i++ {
		a := <-result
		for k, v := range a {
			data[k] += toolkit.ToFloat64(v, 6, toolkit.RoundingAuto)
		}

		if i%step == 0 {
			toolkit.Printfn("Worker %d of %d (%d), Done in %s",
				i,
				len(seeds),
				(i / step),
				time.Since(t0).String())
		}
	}

	for k, v := range data {
		toolkit.Printfn("%s,%v", k, v)
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

func workerproc(wi int, filter *dbox.Filter, result chan<- toolkit.M) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()
	tkm := toolkit.M{}

	csr, _ := workerconn.NewQuery().Select("date.fiscal", "pldatas").
		From(tablename).
		Where(filter).
		Cursor(nil)

	defer csr.Close()

	scount := csr.Count()
	iscount := 0
	step := scount / 100

	if step == 0 {
		step = 1
	}

	for {
		iscount++
		spl := new(gdrj.SalesPL)
		e := csr.Fetch(spl, 1, false)
		if e != nil {
			break
		}

		fiscal := spl.Date.Fiscal
		for k, v := range spl.PLDatas {
			key := toolkit.Sprintf("%s_%s", fiscal, k)
			tv := v.Amount + tkm.GetFloat64(key)
			tkm.Set(key, tv)
		}

		if iscount == 2 {
			break
		}

	}

	result <- tkm

	toolkit.Printfn("Go %d. Processing done in %s",
		wi,
		time.Since(t0).String())
}
