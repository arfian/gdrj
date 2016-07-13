package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

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
	Key     string
	Current float64
	Expect  float64
}

var plallocs = map[string]map[string]*plalloc{}

func buildRatio(tn string) error {
	plallocs = map[string]map[string]*plalloc{}
	rconn, _ := modules.GetDboxIConnection("db_godrej")
	defer rconn.Close()

	totalBlanks := map[string]float64{}

	craws, e := rconn.NewQuery().From("rawdiscountact_11072016").
		Select().Cursor(nil)
	if e != nil {
		return e
	}
	defer craws.Close()
	count := craws.Count()
	i := 0
	for {
		mraw := toolkit.M{}
		if e = craws.Fetch(mraw, 1, false); e != nil {
			break
		}
		i++
		toolkit.Printfn("Ratio 0: %d of %d in %s",
			i, count, time.Since(t0).String())
		yr := mraw.GetInt("year")
		fiscal := toolkit.Sprintf("%d-%d", yr, yr+1)
		kacode := mraw.GetString("keyaccountcode")

		plallocf := plallocs[fiscal]
		totalBlank := totalBlanks[fiscal]
		if plallocf == nil {
			plallocf = map[string]*plalloc{}
		}
		pla := plallocf[kacode]
		if pla == nil {
			pla = new(plalloc)
		}
		value := mraw.GetFloat64("amountinidr")
		pla.Expect += value
		plallocf[kacode] = pla
		plallocs[fiscal] = plallocf
	}

	ctrx, e := rconn.NewQuery().From(tn).
		Select().Cursor(nil)
	if e != nil {
		return e
	}
	defer ctrx.Close()
	count = ctrx.Count()
	i = 0
	for {
		mtrx := toolkit.M{}
		if e = ctrx.Fetch(&mtrx, 1, false); e != nil {
			break
		}
		i++
		toolkit.Printfn("Ratio 1: %d of %d in %s",
			i, count, time.Since(t0).String())

		key := mtrx.Get("key", toolkit.M{}).(toolkit.M)
		fiscal := key.GetString("date_fiscal")
		kacode := key.GetString("customer_customergroupname")

		falloc := plallocs[fiscal]
		if falloc != nil {
			kalloc := falloc[kacode]
			if kalloc != nil {
				kalloc.Current += mtrx.GetFloat64("PL7A")
				falloc[kacode] = kalloc
				plallocs[fiscal] = falloc
			}
		}
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

	for _, tn := range tablenames {
		e := buildRatio(tn)
		if e != nil {
			toolkit.Printfn("Build ratio error: %s - %s", tn, e.Error())
			return
		}

		e = processTable(tn)
		if e != nil {
			toolkit.Printfn("Process table error: %s - %s", tn, e.Error())
			return
		}
	}
}

func processTable(tn string, ratio map[string]map[string]*sgaalloc) error {
	toolkit.Printfn("Processing with alloc as follow: %s", toolkit.JsonString(ratio))

	cursor, _ := conn.NewQuery().From(tn).Select().Cursor(nil)
	defer cursor.Close()

	count := cursor.Count()
	i := 0
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
		fiscal := key.GetString("date_fiscal")
		channelid := key.GetString("customer_channelid")
		fratio := ratio[fiscal]
		if fratio == nil {
			continue
		}
		sratio := fratio[channelid]
		if sratio == nil {
			continue
		}

		salesRatio := mr.GetFloat64("PL8A") / sratio.TotalSales
		for k, v := range mr {
			if toolkit.HasMember([]string{"PL33", "PL34", "PL35", "PL94", "PL94A"}, k) {
				newv := v.(float64) + salesRatio*(sratio.TotalExpect-sratio.TotalNow)
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
