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
	ChannelID                                    string
	TotalNow, TotalExpect, RatioNow, RatioExpect float64
	TotalSales                                   float64
}

func (s *plalloc) Multiplier() float64 {
	if s.RatioNow == 0 {
		return 0
	}
	return s.RatioExpect / s.RatioNow
}

func calcDiff(tablename string) (m map[string]map[string]*plalloc, err error) {
	diffConn, _ := modules.GetDboxIConnection("db_godrej")
	defer diffConn.Close()

	m = map[string]map[string]*plalloc{}
	totalplvs := map[string]float64{}
	totalsaless := map[string]float64{}
	sumnow, _ := diffConn.NewQuery().From(tablename).
		Cursor(nil)
	count := sumnow.Count()
	i := 0
	for {
		mnow := toolkit.M{}
		efetch := sumnow.Fetch(&mnow, 1, false)
		if efetch != nil {
			break
		}
		i++
		toolkit.Printfn("Calculating diff. %d of %d in %s",
			i, count, time.Since(t0).String())

		key := mnow.Get("key", toolkit.M{}).(toolkit.M)
		channelid := key.GetString("customer_channelid")
		if channelid != "EXP" {
			fiscal := key.GetString("date_fiscal")
			plaf, plafExist := m[fiscal]
			totalplv := totalplvs[fiscal]
			totalsales := totalsaless[fiscal]
			if !plafExist {
				plaf = map[string]*plalloc{}
				m[fiscal] = plaf
			}

			pla, plaExist := plaf[channelid]
			if !plaExist {
				pla = new(plalloc)
				plaf[channelid] = pla
			}
			pla.ChannelID = channelid
			plvalue := mnow.GetFloat64("PL23")
			pla.TotalNow += plvalue
			salesvalue := mnow.GetFloat64("PL8A")
			pla.TotalSales += salesvalue
			totalplv += plvalue
			totalsales += salesvalue
			totalplvs[fiscal] = totalplv
			totalsaless[fiscal] = totalsales
		}
	}

	for fid, fallocs := range m {
		totalplv := totalplvs[fid]
		totalsales := totalsaless[fid]
		for _, calloc := range fallocs {
			//calloc.RatioNow = calloc.TotalNow / total
			calloc.TotalExpect = calloc.TotalSales * totalplv / totalsales
		}
	}

	return
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
		diff, e := calcDiff(tn)
		if e != nil {
			toolkit.Printfn("Calc diff error: %s - %s", tn, e.Error())
			return
		}

		e = processTable(tn, diff)
		if e != nil {
			toolkit.Printfn("Process table error: %s - %s", tn, e.Error())
			return
		}
	}
}

func processTable(tn string, ratio map[string]map[string]*plalloc) error {
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

		if channelid == "EXP" {
			for k, _ := range mr {
				//if toolkit.HasMember([]string{"PL33", "PL34", "PL35", "PL94", "PL94A"}, k) {
				if k == "PL23" {
					newv := float64(0)
					mr.Set(k, newv)
				}
			}
		} else {
			sratio := fratio[channelid]
			if sratio == nil {
				continue
			}

			salesRatio := mr.GetFloat64("PL8A") / sratio.TotalSales
			for k, v := range mr {
				//if toolkit.HasMember([]string{"PL33", "PL34", "PL35", "PL94", "PL94A"}, k) {
				if k == "PL23" {
					newv := v.(float64) + salesRatio*(sratio.TotalExpect-sratio.TotalNow)
					mr.Set(k, newv)
				}
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
