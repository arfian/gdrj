package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"fmt"
	"github.com/eaciit/dbox"
	_ "github.com/eaciit/dbox/dbc/csv"
	_ "github.com/eaciit/dbox/dbc/mongo"
	"github.com/eaciit/toolkit"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

var (
	wd, _     = os.Getwd()
	brandlist = []string{}
	conn      dbox.IConnection
	mwg       sync.WaitGroup
	totalData int
)

func main() {

	setinitialconnection()
	defer gdrj.CloseDb()

	filename := ""

	t0 := time.Now()

	prepmaster()

	filename = "ads_YTD_march_2015" + ".csv"
	fmt.Println("Start", filename)
	getsalesrddata(filename)
	fmt.Println("Done", filename)

	filename = "ads_YTD_march_2016" + ".csv"
	fmt.Println("Start", filename)
	getsalesrddata(filename)
	fmt.Println("Done", filename)

	toolkit.Println("\n\n========= END OF PROCESS =========")
	toolkit.Printfn("Processing %d data in %s",
		totalData, time.Since(t0).String())

}

func prepmaster() {
	brand := new(gdrj.Brand)
	cbrand, err := gdrj.Find(brand, nil, nil)
	if err != nil {
		return
	}

	count := cbrand.Count()
	t0 := time.Now()
	defer cbrand.Close()
	var e error

	for e = cbrand.Fetch(&brand, 1, false); e == nil; {
		brandlist = append(brandlist, brand.Name)
		brand = new(gdrj.Brand)
		e = cbrand.Fetch(&brand, 1, false)
	}

	toolkit.Printfn("Processing %d data in %s",
		count, time.Since(t0).String())

	return
}

func getsalesrddata(filename string) {
	loc := filepath.Join(wd, "data", filename)
	connCsv, err := preparecsvconn(loc)

	if err != nil {
		fmt.Printf("Error connecting to database: %s \n", err.Error())
		os.Exit(1)
	}

	c, err := connCsv.NewQuery().Select().Cursor(nil)
	if err != nil {
		return
	}

	defer c.Close()

	adsdata := toolkit.Ms{}
	err = c.Fetch(&adsdata, 0, false)
	count := c.Count()
	totalData += count
	t0 := time.Now()

	/*i := 0
	jobs := make(chan *gdrj.Ads, count)
	toolkit.Println("Prepare Worker")
	for wi := 0; wi < 50; wi++ {
		go workerAds(wi, jobs)
	}

	mwg.Add(1)

	for err = c.Fetch(&adsdata, 1, false); err == nil; {
		i++
		ads := new(gdrj.Ads)

		ads.ID = toolkit.RandomString(32)
		ads.EntityID = adsdata.GetString("entityid")
		ads.Year = adsdata.GetInt("year")
		ads.Period = adsdata.GetInt("period")
		ads.Account = toolkit.ToString(adsdata.GetInt("account"))
		ads.AccountDescription = adsdata.GetString("accountdescription")
		ads.BrandCategory = adsdata.GetString("brandcategory")
		ads.Brand = brandcats[ads.BrandCategory]
		ads.Grouping = adsdata.GetString("grouping")
		ads.ApProposalNo = adsdata.GetString("approposalno")
		ads.PCID = adsdata.GetString("pcid")
		ads.Amountinidr = adsdata.GetFloat64("amountinidr")
		ads.Src = adsdata.GetString("src")

		toolkit.Printfn("Processing %d of %d data in %s",
			i, count, time.Since(t0).String())
		adsdata := toolkit.M{}
		err = c.Fetch(&adsdata, 1, false)

		jobs <- ads
	}
	close(jobs)
	mwg.Wait() */
	for _, v := range adsdata {
		ads := new(gdrj.Ads)

		ads.ID = toolkit.RandomString(32)
		ads.EntityID = v.GetString("entityid")
		ads.Year = v.GetInt("year")
		ads.Period = v.GetInt("period")
		ads.Account = toolkit.ToString(v.GetInt("account"))
		ads.AccountDescription = v.GetString("accountdescription")
		ads.BrandCategory = v.GetString("brandcategory")
		for _, val := range brandlist {
			if strings.Contains(strings.ToUpper(ads.BrandCategory), val) {
				ads.Brand = val
			}
		}
		ads.Grouping = v.GetString("grouping")
		ads.ApProposalNo = v.GetString("approposalno")
		ads.PCID = v.GetString("pcid")
		ads.Amountinidr = v.GetFloat64("amountinidr")
		ads.Src = v.GetString("src")

		ads.Save()
	}

	toolkit.Printfn("Processing %d data in %s",
		count, time.Since(t0).String())

	return
}

func workerAds(wi int, jobs chan *gdrj.Ads) {
	workerConn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerConn.Close()

	for job := range jobs {
		workerConn.NewQuery().From(new(gdrj.Ads).TableName()).
			Save().Exec(toolkit.M{}.Set("data", job))
	}

	defer mwg.Done()
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

func preparecsvconn(loc string) (dbox.IConnection, error) {
	c, e := dbox.NewConnection("csv",
		&dbox.ConnectionInfo{loc, "", "", "", toolkit.M{}.Set("useheader", true).Set("delimiter", ",")})

	if e != nil {
		return nil, e
	}

	e = c.Connect()
	if e != nil {
		return nil, e
	}

	return c, nil
}
