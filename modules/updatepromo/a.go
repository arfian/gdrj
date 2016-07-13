package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"strings"
	"time"

	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
)

var conn dbox.IConnection
var count int

var (
	t0                          time.Time
	fiscalyear, iscount, scount int
	data                        map[string]float64
	masters                     = toolkit.M{}
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

type plalloc struct {
	Key string
	//Current float64
	//Expect  float64
	//Total   float64

	TotalSales  float64
	TotalValues float64

	GroupSales,
	GLValues,
	GLRatios,
	ExpectedValues map[string]float64
}

var plallocs = map[string]*plalloc{}

func buildRatio() error {
	plallocs = map[string]*plalloc{}
	rconn, _ := modules.GetDboxIConnection("db_godrej")
	defer rconn.Close()

	//totalBlanks := map[string]float64{}

	ctrx, e := rconn.NewQuery().From("rawdatapl_promospg11072016").
		Select().Cursor(nil)
	if e != nil {
		return e
	}
	defer ctrx.Close()

	t0 = time.Now()
	count := ctrx.Count()
	i := 0
	for {
		mtrx := toolkit.M{}
		if e = ctrx.Fetch(&mtrx, 1, false); e != nil {
			break
		}
		i++
		toolkit.Printfn("Ratio 1: %d of %d in %s",
			i, count, time.Since(t0).String())

		//key := mtrx.Get("key", toolkit.M{}).(toolkit.M)
		fiscal := toolkit.Sprintf("%d_%d", mtrx.GetInt("year"), mtrx.GetInt("period"))
		//kacode := key.GetString("keyaccountcode")
		value := mtrx.GetFloat64("amountinidr")
		glcode := mtrx.GetString("account")

		falloc := plallocs[fiscal]
		if falloc == nil {
			falloc = new(plalloc)
		}

		falloc.TotalSales += 0
		falloc.TotalValues += value
		falloc.GLValues[glcode] = falloc.GLValues[glcode] + value
		plallocs[fiscal] = falloc
	}

	csls, _ := rconn.NewQuery().From("salespls-summary").Select().Cursor(nil)
	defer csls.Close()

	count = csls.Count()
	i = 0

	t0 = time.Now()
	for {
		mr := toolkit.M{}
		e := csls.Fetch(&mr, 1, false)
		if e != nil {
			break
		}
		i++
		toolkit.Printfn("Ratio 2: %d of %d in %s",
			i, count, time.Since(t0).String())

		key := mr.Get("key", toolkit.M{}).(toolkit.M)
		kacode := key.GetString("customer_customergroupname")
		keyDate := time.Date(key.GetInt("date_year"), time.Month(key.GetInt("date_month")), 1,
			0, 0, 0, 0, time.UTC)
		fiscalDate := keyDate.AddDate(0, -3, 0)
		keyPeriod := toolkit.Sprintf("%d_%d",
			fiscalDate.Year(), fiscalDate.Month())
		alloc := plallocs[keyPeriod]
		if alloc == nil {
			continue
		}

		sales := mr.GetFloat64("PL8A")
		alloc.TotalSales += sales
		alloc.GroupSales[kacode] = alloc.GroupSales[kacode] + sales
		plallocs[keyPeriod] = alloc
	}

	for k, v := range plallocs {

	}

	return nil
}

func main() {
	t0 = time.Now()

	setinitialconnection()
	defer gdrj.CloseDb()
	prepmastercalc()

	toolkit.Println("Start data query...")
	tablenames := []string{
		"salespls-summary"}

	e := buildRatio()
	if e != nil {
		toolkit.Printfn("Build ratio error: %s", e.Error())
		return
	}

	for _, tn := range tablenames {
		e = processTable(tn)
		if e != nil {
			toolkit.Printfn("Process table error: %s - %s", tn, e.Error())
			return
		}
	}
}

func processTable(tn string) error {
	cursor, _ := conn.NewQuery().From(tn).Select().Cursor(nil)
	defer cursor.Close()

	plmodels := masters.Get("plmodel", nil).(map[string]*gdrj.PLModel)
	count := cursor.Count()
	i := 0
	t0 = time.Now()
	for {
		mr := toolkit.M{}
		ef := cursor.Fetch(&mr, 1, false)
		if ef != nil {
			break
		}

		i++
		toolkit.Printfn("Processing %s, %d of %d in %s",
			tn, i, count, time.Since(t0).String())

		key := mr.Get("key", toolkit.M{}).(toolkit.M)
		kacode := key.GetString("customer_customergroupname")
		keyDate := time.Date(key.GetInt("date_year"), time.Month(key.GetInt("date_month")), 1,
			0, 0, 0, 0, time.UTC)
		fiscalDate := keyDate.AddDate(0, -3, 0)
		keyPeriod := toolkit.Sprintf("%d_%d",
			fiscalDate.Year(), fiscalDate.Month())
		falloc := plallocs[keyPeriod]

		sales := mr.GetFloat64("PL8A")
		for k, _ := range mr {
			if strings.HasPrefix(k, "PL29") ||
				strings.HasPrefix(k, "PL30") ||
				strings.HasPrefix(k, "PL31") {
				newv := float64(0)
				plmodel := plmodels[k]
				if plmodel == nil {
					//continue
				} else if plmodel.GLReff == "" {
					//continue
				} else {
					glratio := falloc.GLRatios[plmodel.GLReff]
					expectedvalue := falloc.ExpectedValues[kacode]
					newv = (sales / falloc.TotalSales) * glratio * expectedvalue
				}
				mr.Set(k, newv)
			}
		}

		mr = CalcSum(mr)
		esave := conn.NewQuery().From(tn).Save().Exec(toolkit.M{}.Set("data", mr))
		if esave != nil {
			return esave
		}
	}

	return nil
}

func CalcSum(tkm toolkit.M) toolkit.M {
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
			//toolkit.Println(k)
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
	tkm.Set("PL94A", sga)
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

	return tkm
}

func buildmap(holder interface{},
	fnModel func() orm.IModel,
	filter *dbox.Filter,
	fnIter func(holder interface{}, obj interface{})) interface{} {
	crx, ecrx := gdrj.Find(fnModel(), filter, nil)
	if ecrx != nil {
		toolkit.Printfn("Cursor Error: %s", ecrx.Error())
		os.Exit(100)
	}
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
