package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"flag"
	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
	"time"
)

var conn dbox.IConnection
var count int

// var mwg sync.WaitGroup

var (
	t0                                time.Time
	custgroup, prodgroup, plcode, ref string
	value, fiscalyear                 int
	globalval                         float64
	mapkeysvalue                      map[string]float64
	masters                           toolkit.M
	tablename                         = "salespls-1"
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

func getCursor(obj orm.IModel) dbox.ICursor {
	c, e := gdrj.Find(obj,
		nil, nil)
	//toolkit.M{}.Set("take", 10))
	if e != nil {
		return nil
	}
	return c
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
	toolkit.Println("--> Sub Channel")

	subchannels := toolkit.M{}
	csr, _ := conn.NewQuery().From("subchannels").Cursor(nil)
	defer csr.Close()
	for {
		m := toolkit.M{}
		e := csr.Fetch(&m, 1, false)
		if e != nil {
			break
		}
		subchannels.Set(m.GetString("_id"), m.GetString("title"))
	}
	masters.Set("subchannels", subchannels)

	customers := toolkit.M{}
	toolkit.Println("--> Customer")
	ccb := getCursor(new(gdrj.Customer))
	defer ccb.Close()
	for {
		cust := new(gdrj.Customer)
		e := ccb.Fetch(cust, 1, false)
		if e != nil {
			break
		}

		customers.Set(cust.ID, cust)
	}
	masters.Set("customers", customers)

	branchs := toolkit.M{}
	cmb := getCursor(new(gdrj.MasterBranch))
	defer cmb.Close()
	for {
		stx := toolkit.M{}
		e := cmb.Fetch(&stx, 1, false)
		if e != nil {
			break
		}

		branchs.Set(stx.Get("_id", "").(string), stx)
	}
	masters.Set("branchs", branchs)
}

func main() {
	t0 = time.Now()
	mapkeysvalue = make(map[string]float64)

	flag.IntVar(&value, "value", 0, "representation of value need to be allocation. Default is 0")
	flag.IntVar(&fiscalyear, "year", 2015, "YYYY representation of godrej fiscal year. Default is 2015")
	flag.StringVar(&ref, "ref", "", "Reference from document or other. Default is blank")
	flag.Parse()

	if value == 0 {
		toolkit.Println("Value are mandatory to fill")
		os.Exit(1)
	}

	setinitialconnection()
	defer gdrj.CloseDb()

	toolkit.Println("Get Data Master...")
	prepmaster()

	toolkit.Println("Start Data Process...")

	toolkit.Printfn("Preparing the data")

	amount := toolkit.ToFloat64(value/12, 6, toolkit.RoundingAuto)
	for i := 1; i <= 12; i++ {
		Date := time.Date(fiscalyear, time.Month(i), 1, 0, 0, 0, 0, time.UTC).AddDate(-1, 3, 0)

		tcustomer := new(gdrj.Customer)
		tproduct := gdrj.ProductGetBySKUID("40011932")
		tpc := gdrj.ProfitCenterGetByID(toolkit.Sprintf("CD02%v", tproduct.BrandCategoryID))
		tcc := new(gdrj.CostCenter)

		tcustomer.Name = "CUSTOMER VIRTUAL"
		tcustomer.BranchID = "CD02"
		tcustomer.ChannelID = "I3"
		tcustomer.ChannelName = "MT"
		tcustomer.CustomerGroup = "MD"
		tcustomer.CustomerGroupName = "Modern Market"
		//s.Customer.ID, s.Product.ID, s.PC.ID, s.CC.ID
		spl := new(gdrj.SalesPL)
		spl.Date = gdrj.SetDate(Date)

		spl.SKUID = "40011932"

		spl.Customer = tcustomer
		spl.Product = tproduct
		spl.Source = "ADJUST"
		spl.Ref = "SALES"
		spl.PC = tpc
		spl.CC = tcc

		spl.GrossAmount = amount
		spl.NetAmount = amount

		// plmodels := masters.Get("plmodel").(map[string]*gdrj.PLModel)
		spl.CleanAndClasify(masters)
		spl.RatioCalc(masters)
		spl.CalcSales(masters)
		spl.CalcRoyalties2016(masters)
		spl.CalcSum(masters)

		spl.ID = toolkit.Sprintf("%s-%s/2015-2016/%s/%d", spl.Ref, spl.Source, spl.SKUID, i)

		// gdrj.Save(spl)
		conn.NewQuery().From(tablename).
			Save().Exec(toolkit.M{}.Set("data", spl))

		toolkit.Printfn("Saving %d of %d in %s", i, 12,
			time.Since(t0).String())
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

//3520055976
// -value=3520055982 -year=2016
