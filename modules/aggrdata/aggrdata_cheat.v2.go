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

func prepmastercalc() {

	toolkit.Println("--> PL MODEL")
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
	prepmastercalc()

	toolkit.Println("Start data query...")

	// filter := dbox.Eq("date.fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	// eperiode := time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	// speriode := eperiode.AddDate(-1, 0, 0)

	// filter := dbox.And(dbox.Gte("date.date", speriode), dbox.Lt("date.date", eperiode))

	// c, _ := gdrj.Find(new(gdrj.SalesPL), filter, nil)
	// defer c.Close()
	csr, _ := conn.NewQuery().Select().From("pl_customer_channelid_date_fiscal").Cursor(nil)
	defer csr.Close()

	scount = csr.Count()
	iscount = 0

	for {
		iscount++
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			toolkit.Println("EOF")
			break
		}

		// "customer_channelid" : "I3",
		//       "date_fiscal" : "2014-2015"
		dtkm, _ := toolkit.ToM(tkm.Get("key"))
		// for k, v := range dtkm {
		// 	if k == "customer_channelid" {
		// 		vch = toolkit.ToString(v)
		// 	} else {
		// 		vfiscal = toolkit.ToString(v)
		// 	}
		// }

		// tkm.Set("key", dtkm)
		// tkm.Set("_id", toolkit.Sprintf("%s_%s", vch, vfiscal))

		// 101,461,675

		// if dtkm.GetString("date_fiscal") == "2015-2016" && dtkm.GetString("customer_channelid") == "I1" {
		// 	v := tkm.GetFloat64("PL2") + 101461675
		// 	tkm.Set("PL2", v)

		// 	v = -101461675
		// 	tkm.Set("PL8", v)

		// 	CalcSum(tkm)
		// }

		// if dtkm.GetString("date_fiscal") == "2015-2016" {
		// 	// 2016
		// 	pl.AddData("PL25", -netsalesamount*2.85900895/100, plmodels)
		// } else {
		// 	// 2015
		// 	pl.AddData("PL25", -netsalesamount*2.82683/100, plmodels)
		// }

		// PL9

		vNetSales := tkm.GetFloat64("PL8A")
		if dtkm.GetString("date_fiscal") == "2014-2015" {
			tkm.Set("PL25", -vNetSales*2.82683/100)
		} else {
			tkm.Set("PL25", -vNetSales*0.0285214595423635)

			// if dtkm.GetString("customer_channelid") == "I2" { //GT
			// 	tkm.Set("PL7A", float64(-18590524688))
			// } else if dtkm.GetString("customer_channelid") == "I4" { //Industrial
			// 	tkm.Set("PL7A", float64(-655115931))
			// } else if dtkm.GetString("customer_channelid") == "I3" { //MT
			// 	tkm.Set("PL7A", float64(-157323938368))
			// } else if dtkm.GetString("customer_channelid") == "I6" { //Motorist
			// 	tkm.Set("PL7A", float64(-57345916))
			// }

			// General Trade  18,590,524,688.00
			// Industrial Trade  655,115,931.00
			// Modern Trade  157,323,938,368.00
			// Motorists  57,345,916.00
		}
		CalcSum(tkm)

		// 	v := tkm.GetFloat64("PL7")
		// 	tkm.Set("PL7", -v)

		// 	v = tkm.GetFloat64("PL8")
		// 	tkm.Set("PL8", -v)

		// 	v = tkm.GetFloat64("PL44")
		// 	tkm.Set("PL44", -v)

		// 	v = tkm.GetFloat64("PL9")
		// 	dv := v + ((v / allpl9) * 25838428343)
		// 	tkm.Set("PL9", dv)

		// }

		err := workerconn.NewQuery().
			From("pl_customer_channelid_date_fiscal-test").
			SetConfig("multiexec", true).
			Save().Exec(toolkit.M{}.Set("data", tkm))

		if err != nil {
			toolkit.Println(err)
		}

		toolkit.Printfn("Processing %d of %d in %s", iscount, scount,
			time.Since(t0).String())

	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

func CalcSum(tkm toolkit.M) {
	var netsales, cogs, grossmargin, sellingexpense,
		sga, opincome, directexpense, indirectexpense,
		royaltiestrademark, advtpromoexpense, operatingexpense,
		freightexpense, nonoprincome, ebt, taxexpense,
		percentpbt, eat, totdepreexp, damagegoods, ebitda, ebitdaroyalties, ebitsga,
		grosssales, discount, advexp, promoexp, spgexp float64

	exclude := []string{"PL8A", "PL14A", "PL74A", "PL26A", "PL32A", "PL39A", "PL41A", "PL44A",
		"PL74B", "PL74C", "PL32B", "PL94B", "PL94C", "PL39B", "PL41B", "PL41C", "PL44B", "PL44C", "PL44D", "PL44E",
		"PL44F", "PL6A", "PL0", "PL28", "PL29A", "PL31"}
	//"PL94A",
	plmodels := masters.Get("plmodel").(map[string]*gdrj.PLModel)

	inexclude := func(f string) bool {
		for _, v := range exclude {
			if v == f {
				return true
			}
		}

		return false
	}

	for k, v := range tkm {
		if k == "_id" {
			continue
		}

		if inexclude(k) {
			continue
		}

		// arrk := strings.Split(k, "_")

		plmodel, exist := plmodels[k]
		if !exist {
			toolkit.Println(k)
			continue
		}
		Amount := toolkit.ToFloat64(v, 6, toolkit.RoundingAuto)
		// PLHeader1
		// PLHeader2
		// PLHeader3
		// switch v.Group1 {
		switch plmodel.PLHeader1 {
		case "Net Sales":
			netsales += Amount
		case "Direct Expense":
			directexpense += Amount
		case "Indirect Expense":
			indirectexpense += Amount
		case "Freight Expense":
			freightexpense += Amount
		case "Royalties & Trademark Exp":
			royaltiestrademark += Amount
		case "Advt & Promo Expenses":
			advtpromoexpense += Amount
		case "G&A Expenses":
			sga += Amount
		case "Non Operating (Income) / Exp":
			nonoprincome += Amount
		case "Tax Expense":
			taxexpense += Amount
		case "Total Depreciation Exp":
			if plmodel.PLHeader2 == "Damaged Goods" {
				damagegoods += Amount
			} else {
				totdepreexp += Amount
			}
		}

		// switch v.Group2 {
		switch plmodel.PLHeader2 {
		case "Gross Sales":
			grosssales += Amount
		case "Discount":
			discount += Amount
		case "Advertising Expenses":
			advexp += Amount
		case "Promotions Expenses":
			promoexp += Amount
		case "SPG Exp / Export Cost":
			spgexp += Amount
		}
	}

	cogs = directexpense + indirectexpense
	grossmargin = netsales + cogs
	sellingexpense = freightexpense + royaltiestrademark + advtpromoexpense
	operatingexpense = sellingexpense + sga
	opincome = grossmargin + operatingexpense
	ebt = opincome + nonoprincome //asume nonopriceincome already minus
	percentpbt = 0
	if ebt != 0 {
		percentpbt = taxexpense / ebt * 100
	}
	eat = ebt + taxexpense
	ebitda = totdepreexp + damagegoods + opincome
	ebitdaroyalties = ebitda - royaltiestrademark
	ebitsga = opincome - sga
	ebitsgaroyalty := ebitsga - royaltiestrademark

	tkm.Set("PL0", grosssales)
	tkm.Set("PL6A", discount)
	tkm.Set("PL8A", netsales)
	tkm.Set("PL14A", directexpense)
	tkm.Set("PL74A", indirectexpense)
	tkm.Set("PL26A", royaltiestrademark)
	tkm.Set("PL32A", advtpromoexpense)
	// tkm.Set("PL94A", sga)
	tkm.Set("PL39A", nonoprincome)
	tkm.Set("PL41A", taxexpense)
	tkm.Set("PL44A", totdepreexp)

	tkm.Set("PL28", advexp)
	tkm.Set("PL29A", promoexp)
	tkm.Set("PL31", spgexp)
	tkm.Set("PL74B", cogs)
	tkm.Set("PL74C", grossmargin)
	tkm.Set("PL32B", sellingexpense)
	tkm.Set("PL94B", operatingexpense)
	tkm.Set("PL94C", opincome)
	tkm.Set("PL39B", ebt)
	tkm.Set("PL41B", percentpbt)
	tkm.Set("PL41C", eat)
	tkm.Set("PL44B", opincome)
	tkm.Set("PL44C", ebitda)
	tkm.Set("PL44D", ebitdaroyalties)
	tkm.Set("PL44E", ebitsga)
	tkm.Set("PL44F", ebitsgaroyalty)
}
