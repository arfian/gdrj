package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
	"os"
	"sync"
	"time"
)

var conn dbox.IConnection
var mwg sync.WaitGroup

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

var (
	pcs = toolkit.M{}
)

func getCursor(obj orm.IModel) dbox.ICursor {
	c, e := gdrj.Find(obj, nil, nil)
	if e != nil {
		return nil
	}
	return c
}

func prepMaster() {
	geo := new(gdrj.OutletGeo)
	geos := toolkit.M{}

	cgeo := getCursor(geo)
	defer cgeo.Close()
	var e error

	for e = cgeo.Fetch(geo, 1, false); e == nil; {
		geos.Set(toolkit.ToString(geo.ID), geo)
		geo = new(gdrj.OutletGeo)
		e = cgeo.Fetch(geo, 1, false)
	}

	salesrd := new(gdrj.SalesRD)
	csalesrd := getCursor(salesrd)
	defer csalesrd.Close()
	t0 := time.Now()
	count := csalesrd.Count()
	i := 0
	jobs := make(chan *gdrj.SalesRDClean, count)
	result := make(chan string, count)
	toolkit.Println("Prepare Worker")
	for wi := 0; wi < 10; wi++ {
		go worker(wi, jobs, result)
	}

	for e = csalesrd.Fetch(salesrd, 1, false); e == nil; {
		i++
		cleanrd := new(gdrj.SalesRDClean)

		_geo := geos[toolkit.ToString(salesrd.OutletID)].(*gdrj.OutletGeo)
		cleanrd.City = _geo.City
		cleanrd.Area = _geo.Area
		cleanrd.Region = _geo.Region
		cleanrd.Zone = _geo.Zone
		cleanrd.National = _geo.National
		cleanrd.ID = salesrd.ID
		cleanrd.Period = salesrd.Period
		cleanrd.Year = salesrd.Period
		cleanrd.EntityID = salesrd.EntityID
		cleanrd.BranchID = salesrd.BranchID
		cleanrd.Account = toolkit.ToString(salesrd.Account)
		cleanrd.CCID = salesrd.CCID
		cleanrd.PCID = salesrd.PCID
		cleanrd.SKUID = toolkit.ToString(salesrd.SKUID)
		cleanrd.ProductName = salesrd.ProductName
		cleanrd.OutletID = toolkit.ToString(salesrd.OutletID)
		cleanrd.OutletName = salesrd.OutletName
		cleanrd.AmountinIDR = salesrd.AmountinIDR

		toolkit.Printfn("Processing %d of %d data %s in %s", i, count, cleanrd.SKUID, time.Since(t0).String())
		salesrd = new(gdrj.SalesRD)
		e = csalesrd.Fetch(salesrd, 1, false)
		jobs <- cleanrd
	}
	close(jobs)
	mwg.Wait()
}

func main() {
	setinitialconnection()
	defer gdrj.CloseDb()

	prepMaster()

}
func worker(wi int, jobs <-chan *gdrj.SalesRDClean, result chan<- string) {
	workerConn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerConn.Close()

	for job := range jobs {
		workerConn.NewQuery().From("salesrdclean").
			Save().Exec(toolkit.M{}.Set("data", job))
	}

	mwg.Done()
}
