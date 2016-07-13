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
	customers = toolkit.M{}
	conn      dbox.IConnection
	mwg       sync.WaitGroup
	totalData int
)

func main() {

	setinitialconnection()
	defer gdrj.CloseDb()

	filename := ""

	t0 := time.Now()

	getcustomerdata()

	for i := 1; i <= 75; i++ {
		filename = toolkit.ToString(i) + ".csv"
		fmt.Println("Start", filename)
		getsalesrddata(filename)
		fmt.Println("Done", filename)
	}
	toolkit.Println("\n\n========= END OF PROCESS =========")
	toolkit.Printfn("Processing %d data in %s",
		totalData, time.Since(t0).String())

}

func getcustomerdata() {
	customer := new(gdrj.MasterCustomerRD)
	ccustomer, err := gdrj.Find(customer, nil, nil)
	if err != nil {
		return
	}

	count := ccustomer.Count()
	totalData += count
	t0 := time.Now()
	defer ccustomer.Close()
	var e error

	curChannel := "currentChannel"
	curChannelName := ""
	curCustType := "currentCustomerType"
	curCustGroup := "currentCustomerGroup"
	curCustGroupName := ""
	for e = ccustomer.Fetch(&customer, 1, false); e == nil; {
		if (curChannel == "currentChannel" || curChannel != customer.ChannelID) && customer.ChannelID != "" {
			curChannel = customer.ChannelID
			curChannelName = customer.ChannelName
		}
		if (curCustType == "currentCustomerType" || curCustType != customer.CustType) && customer.CustType != "" {
			curCustType = customer.CustType
		}
		if (curCustGroup == "currentCustomerGroup" || curCustGroup != customer.CustGroup) && customer.CustGroup != "" {
			curCustGroup = customer.CustGroup
			curCustGroupName = customer.CustGroupName
		}
		customer.ChannelID = curChannel
		customer.ChannelName = curChannelName
		if curCustType == "2019" {
			customer.CustType = "2019"
			customer.CustTypeName = "2019"
		} else {
			customer.CustType = strings.TrimSpace(strings.Split(curCustType, "-")[0])
			customer.CustTypeName = strings.TrimSpace(strings.Split(curCustType, "-")[1])
		}
		customer.CustGroup = curCustGroup
		customer.CustGroupName = curCustGroupName
		customers.Set(customer.OutletID, customer)
		customer = new(gdrj.MasterCustomerRD)
		e = ccustomer.Fetch(&customer, 1, false)
	}

	toolkit.Printfn("Processing %d data in %s",
		count, time.Since(t0).String())

	return
}

func setDateAmount(jobs chan *gdrj.SalesRDManeh, salesrd *gdrj.SalesRDManeh, date string, amount interface{}) {
	_date := strings.Split(date, ".")
	salesrd.Month = toolkit.ToInt(_date[0], toolkit.RoundingAuto)
	salesrd.Year = toolkit.ToInt(_date[1], toolkit.RoundingAuto)
	salesrd.Amount = toolkit.ToFloat64(amount, 6, toolkit.RoundingAuto) * 1000000
	jobs <- salesrd
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

	salesdata := toolkit.Ms{}
	err = c.Fetch(&salesdata, 0, false)
	count := c.Count()
	totalData += count
	t0 := time.Now()
	i := 0
	jobs := make(chan *gdrj.SalesRDManeh, count)
	toolkit.Println("Prepare Worker")
	for wi := 0; wi < 10; wi++ {
		go worker(wi, jobs)
	}
	currentOutlet := "currentOutlet"
	currentCustomer := ""
	dateList := []string{"9.2014", "10.2014", "11.2014", "12.2015", "1.2015", "2.2015", "3.2015",
		"4.2015", "5.2015", "6.2015", "7.2015", "8.2015", "9.2015", "10.2015", "11.2015", "12.2015",
		"1.2016", "2.2016", "3.2016"}

	mwg.Add(10)
	for _, v := range salesdata {
		i++
		if toolkit.TypeName(v["outletid"]) == "string" {
			if (currentOutlet == "currentOutlet" || currentOutlet != v.GetString("outletid")) && v.GetString("outletid") != "" {
				currentOutlet = v.GetString("outletid")
				currentCustomer = v.GetString("customername")
			}
		} else {
			if (currentOutlet == "currentOutlet" || currentOutlet != toolkit.ToString(v.GetFloat64("outletid"))) && v.GetFloat64("outletid") != 0 {
				currentOutlet = toolkit.ToString(v.GetFloat64("outletid"))
				currentCustomer = v.GetString("customername")
			}
		}
		salesrd := new(gdrj.SalesRDManeh)

		salesrd.ID = toolkit.RandomString(32)
		salesrd.SKUID = toolkit.ToString(v.GetInt("skuid"))
		salesrd.ProductName = v.GetString("productname")
		salesrd.OutletID = currentOutlet
		salesrd.CustomerName = currentCustomer
		salesrd.City = v.GetString("city")
		salesrd.Src = v.GetString("src")

		if customers.Has(currentOutlet) {
			customer := customers[currentOutlet].(*gdrj.MasterCustomerRD)
			salesrd.CustType = customer.CustType
			salesrd.CustTypeName = customer.CustTypeName
			salesrd.ChannelID = customer.ChannelID
			salesrd.ChannelName = customer.ChannelName
			salesrd.CustGroup = customer.CustGroup
			salesrd.CustGroupName = customer.CustGroupName
		}

		for _, val := range dateList {
			if v.GetFloat64(val) != 0 {
				setDateAmount(jobs, salesrd, val, v[val])
			}
		}

	}
	close(jobs)
	mwg.Wait()

	toolkit.Printfn("Processing %d data in %s",
		count, time.Since(t0).String())

	return
}

func worker(wi int, jobs chan *gdrj.SalesRDManeh) {
	workerConn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerConn.Close()

	for job := range jobs {
		workerConn.NewQuery().From(new(gdrj.SalesRDManeh).TableName()).
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
