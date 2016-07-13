package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"flag"
	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
	"strings"
	"time"
)

var conn dbox.IConnection
var count int

var (
	t0                          time.Time
	fiscalyear, iscount, scount int
	data                        map[string]float64
	masters                     = toolkit.M{}

	alloc = map[string]float64{
		"I1": 0.17,
		"I3": 0.51,
		"I2": 0.32,
	}
)

type sgaalloc struct {
	ChannelID                                    string
	TotalNow, TotalExpect, RatioNow, RatioExpect float64
	TotalSales                                   float64
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

func prepmasterrevadv() {
	toolkit.Println("--> Advertisement Revision")
	advertisements := toolkit.M{}

	csradv, _ := conn.NewQuery().From("rawdatapl_ads30062016").
		Where(dbox.Eq("year", fiscalyear-1)).
		Cursor(nil)

	defer csradv.Close()
	for {
		m := toolkit.M{}
		e := csradv.Fetch(&m, 1, false)

		if e != nil {
			break
		}

		Date := time.Date(m.GetInt("year"), time.Month(m.GetInt("period")), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 3, 0)
		key := toolkit.Sprintf("%d_%d", Date.Year(), Date.Month())

		if len(m.GetString("brand")) > 2 {
			key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("brand"))))
		}

		tadv := toolkit.M{}
		if advertisements.Has(key) {
			tadv = advertisements.Get(key).(toolkit.M)
		}

		skey := "PL28I"
		tstr := strings.TrimSpace(strings.ToUpper(m.GetString("accountdescription")))
		switch tstr {
		case "ADVERTISEMENT - INTERNET":
			skey = "PL28A"
		case "ADVERTISEMENT - PRODN - DESIGN - DVLOPMNT":
			skey = "PL28B"
		case "ADVERTISEMENT - TV":
			skey = "PL28C"
		case "MARKET RESEARCH":
			skey = "PL28D"
		case "FAIRS & EVENTS":
			skey = "PL28E"
		case "AGENCY FEES":
			skey = "PL28F"
		case "ADVERTISEMENT - POP MATERIALS":
			skey = "PL28G"
		case "SPONSORSHIP":
			skey = "PL28H"
		}

		v := tadv.GetFloat64(skey) + m.GetFloat64("amountinidr")
		tadv.Set(skey, v)
		advertisements[key] = tadv
	}

	masters.Set("advertisements", advertisements)
}

func prepmasterrevpromospg() {
	toolkit.Println("--> Promotion and SPG Revision")
	promotions := toolkit.M{}

	csradv, _ := conn.NewQuery().From("rawdatapl_promospg11072016").
		Where(dbox.Eq("year", fiscalyear-1)).
		Cursor(nil)

	defer csradv.Close()

	// "date_year" : 2014.0
	// "date_month" : 7.0,
	// "customer_branchid" : "CD12",
	// "customer_channelid" : "I2",
	// "customer_customergroup" : "TM",
	// "product_brand" : "MITU",

	// "year" : NumberInt(2014),
	// "period" : NumberInt(1),
	// "amountinidr" : -9000000.0,
	// "accountdescription" : "GONDOLA",
	// "grouping" : "Promotion Expenses",
	// "channelid" : "I3",
	// "branchid" : "CD04",
	// "keyaccountcode" : "",
	// "brand" : ""

	for {
		m := toolkit.M{}
		e := csradv.Fetch(&m, 1, false)

		if e != nil {
			break
		}

		agroup := "promo"
		if strings.Contains(strings.ToUpper(m.GetString("grouping")), "SPG") {
			agroup = "spg"
		}

		Date := time.Date(m.GetInt("year"), time.Month(m.GetInt("period")), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 3, 0)
		key := toolkit.Sprintf("%s_%d_%d", agroup, Date.Year(), Date.Month())

		if len(m.GetString("branchid")) > 2 {
			key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("branchid"))))
			if len(m.GetString("channelid")) == 2 {
				key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("channelid"))))
				if len(m.GetString("keyaccountcode")) > 1 {
					key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("keyaccountcode"))))
					if len(m.GetString("brand")) > 1 {
						key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("brand"))))
					}
				}
			}
		} else if len(m.GetString("channelid")) == 2 {
			key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("channelid"))))
		}

		tpromo := toolkit.M{}
		if promotions.Has(key) {
			tpromo = promotions.Get(key).(toolkit.M)
		}

		skey := ""
		if agroup == "spg" {
			skey = "PL31E"
			tstr := strings.ToUpper(strings.TrimSpace(m.GetString("accountdescription")))
			switch tstr {
			case "SPG EXPENSES - MANUAL":
				skey = "PL31D"
			case "SPG EXPENSES":
				skey = "PL31C"
			case "SPG ALLOCATION":
				skey = "PL31B"
			case "COORDINATION FEE":
				skey = "PL31A"
			}
		} else {
			tstr := strings.TrimSpace(m.GetString("accountdescription"))
			plmodels := masters.Get("plmodel").(map[string]*gdrj.PLModel)
			skey = "PL29A32"
			for _, v := range plmodels {
				if v.PLHeader2 == "Promotions Expenses" && v.PLHeader3 == tstr {
					skey = v.ID
				}
			}
		}

		v := tpromo.GetFloat64(skey) + m.GetFloat64("amountinidr")
		tpromo.Set(skey, v)
		promotions[key] = tpromo
	}

	masters.Set("promotions", promotions)
}

func prepmasterrevfreight() {
	toolkit.Println("--> Freight Revision")
	freights := toolkit.M{}

	csr, _ := conn.NewQuery().From("rawdatapl_freight").
		Where(dbox.Eq("year", fiscalyear-1)).
		Cursor(nil)

	defer csr.Close()
	for {
		m := toolkit.M{}
		e := csr.Fetch(&m, 1, false)

		if e != nil {
			break
		}

		Date := time.Date(m.GetInt("year"), time.Month(m.GetInt("period")), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 3, 0)
		key := toolkit.Sprintf("%d_%d", Date.Year(), Date.Month())

		v := freights.GetFloat64(key) + m.GetFloat64("amountinidr")
		freights.Set(key, v)
	}

	masters.Set("freights", freights)
}

func prepmasterrevdiscountactivity() {
	toolkit.Println("--> Discount Activity")
	discountactivities := toolkit.M{}

	csr, _ := conn.NewQuery().From("rawdiscountact_11072016").
		Where(dbox.Eq("year", fiscalyear-1)).
		Cursor(nil)

	defer csr.Close()
	for {
		m := toolkit.M{}
		e := csr.Fetch(&m, 1, false)

		if e != nil {
			break
		}

		Date := time.Date(m.GetInt("year"), time.Month(m.GetInt("period")), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 3, 0)
		key := toolkit.Sprintf("%d_%d", Date.Year(), Date.Month())

		// "date_year" : 2014.0
		// "date_month" : 7.0,
		// "customer_branchid" : "CD12",
		// "customer_channelid" : "I2",
		// "customer_customergroup" : "TM",
		// "product_brand" : "MITU",

		// "year" : NumberInt(2014),
		// "period" : NumberInt(1),
		// "amountinidr" : 145035.0,
		// "channelid" : "I3",
		// "branchid" : "CD02",
		// "keyaccountgroup" : "(blank)",
		// "brand" : "HIT",

		if len(m.GetString("branchid")) > 2 && m.GetString("branchid") != "(blank)" {
			key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("branchid"))))
			if len(m.GetString("channelid")) > 1 && m.GetString("channelid") != "(blank)" {
				key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("channelid"))))
				if len(m.GetString("keyaccountgroup")) > 1 && m.GetString("keyaccountgroup") != "(blank)" {
					key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("keyaccountgroup"))))
					if len(m.GetString("brand")) > 2 && m.GetString("brand") != "(blank)" {
						key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("brand"))))
					}
				}
			}
		} else if len(m.GetString("channelid")) > 1 && m.GetString("channelid") != "(blank)" {
			key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("channelid"))))
		} else if len(m.GetString("brand")) > 2 && m.GetString("brand") != "(blank)" {
			key = toolkit.Sprintf("%s_%s", key, strings.TrimSpace(strings.ToUpper(m.GetString("brand"))))
		}

		v := discountactivities.GetFloat64(key) + m.GetFloat64("amountinidr")
		discountactivities.Set(key, v)
	}

	masters.Set("discountactivities", discountactivities)
}

func prepmasterratio() {
	toolkit.Println("--> Master Ratio")

	filter := dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	csr, _ := conn.NewQuery().Select().Where(filter).From("salespls-summary").Cursor(nil)
	defer csr.Close()
	ratio := toolkit.M{}

	for {
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			break
		}

		dtkm, _ := toolkit.ToM(tkm.Get("key"))
		key := toolkit.Sprintf("%d_%d", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"))
		v := ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

		if dtkm.GetString("customer_channelid") != "EXP" {
			key = toolkit.Sprintf("ExEXP_%d_%d", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"))
			v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
			ratio.Set(key, v)
		}

		key = toolkit.Sprintf("%d_%d_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"), strings.ToUpper(dtkm.GetString("product_brand")))
		v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

		key = toolkit.Sprintf("%d_%d_%s_%s_%s_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
			dtkm.GetString("customer_branchid"), dtkm.GetString("customer_channelid"),
			dtkm.GetString("customer_customergroup"), strings.ToUpper(dtkm.GetString("product_brand")))

		v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

		key = toolkit.Sprintf("%d_%d_%s_%s_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
			dtkm.GetString("customer_branchid"), dtkm.GetString("customer_channelid"),
			dtkm.GetString("customer_customergroup"))

		v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

		key = toolkit.Sprintf("%d_%d_%s_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
			dtkm.GetString("customer_branchid"), dtkm.GetString("customer_channelid"))

		v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

		key = toolkit.Sprintf("%d_%d_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
			dtkm.GetString("customer_branchid"))

		v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

		key = toolkit.Sprintf("%d_%d_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
			dtkm.GetString("customer_channelid"))

		v = ratio.GetFloat64(key) + tkm.GetFloat64("grossamount")
		ratio.Set(key, v)

	}

	masters.Set("ratio", ratio)
}

func prepmastersalesreturn() {
	toolkit.Println("--> Sales Return")
	salesreturns := toolkit.M{}

	csrsr, _ := conn.NewQuery().From("salestrxs-return").Select("fiscal", "month", "year", "grossamount", "customer", "product").
		Where(dbox.Eq("fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))).
		Cursor(nil)

	defer csrsr.Close()
	for {
		m := toolkit.M{}
		e := csrsr.Fetch(&m, 1, false)

		if e != nil {
			break
		}

		ctkm, _ := toolkit.ToM(m.Get("customer"))
		ptkm, _ := toolkit.ToM(m.Get("product"))

		key := toolkit.Sprintf("%s|%d|%d|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
			m.GetString("fiscal"), m.GetInt("month"), m.GetInt("year"),
			ctkm.GetString("branchid"), ctkm.GetString("branchname"), ctkm.GetString("keyaccount"),
			ctkm.GetString("channelid"), ctkm.GetString("channelname"), ctkm.GetString("reportchannel"),
			ctkm.GetString("reportsubchannel"), ctkm.GetString("zone"), ctkm.GetString("region"),
			ctkm.GetString("areaname"), ctkm.GetString("customergroup"), ctkm.GetString("customergroupname"),
			ctkm.GetString("custtype"), ptkm.GetString("brand"), "VDIST", "", "")

		v := m.GetFloat64("grossamount") + salesreturns.GetFloat64(key)
		salesreturns.Set(key, v)

	}

	i := 0
	for k, v := range salesreturns {
		toolkit.Println(k, " : ", v)
		i++
		if i == 5 {
			break
		}
	}

	masters.Set("salesreturns", salesreturns)
}

func prepmasterratiomapsalesreturn2016() {
	toolkit.Println("--> Master Ratio and maps for sales return 2016")

	filter := dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	csr, _ := conn.NewQuery().Select().Where(filter).From("salespls-summary").Cursor(nil)
	defer csr.Close()
	ratiosalesreturn2016 := toolkit.M{}
	mapsalesreturn2016 := toolkit.M{}

	for {
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			break
		}

		dtkm, _ := toolkit.ToM(tkm.Get("key"))
		mapkey := toolkit.Sprintf("%s|%d|%d|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
			dtkm.GetString("date_fiscal"), dtkm.GetInt("date_month"), dtkm.GetInt("date_year"),
			dtkm.GetString("customer_branchid"), dtkm.GetString("customer_branchname"), dtkm.GetString("customer_keyaccount"),
			dtkm.GetString("customer_channelid"), dtkm.GetString("customer_channelname"), dtkm.GetString("customer_reportchannel"),
			dtkm.GetString("customer_reportsubchannel"), dtkm.GetString("customer_zone"), dtkm.GetString("customer_region"),
			dtkm.GetString("customer_areaname"), dtkm.GetString("customer_customergroup"), dtkm.GetString("customer_customergroupname"),
			dtkm.GetString("customer_custtype"), dtkm.GetString("product_brand"), dtkm.GetString("trxsrc"),
			dtkm.GetString("source"), dtkm.GetString("ref"))

		mapsalesreturn2016.Set(mapkey, float64(0))

		////Fiscal, Channels, Branches, Brands for 2016,
		key01 := toolkit.Sprintf("%s|%s|%s|%s",
			dtkm.GetString("date_fiscal"), dtkm.GetString("customer_branchid"),
			dtkm.GetString("customer_channelid"), dtkm.GetString("product_brand"))

		key02 := toolkit.Sprintf("%s|%s|%s",
			dtkm.GetString("date_fiscal"), dtkm.GetString("customer_branchid"),
			dtkm.GetString("customer_channelid"))

		v := ratiosalesreturn2016.GetFloat64(key01) + tkm.GetFloat64("grossamount")
		ratiosalesreturn2016.Set(key01, v)

		v = ratiosalesreturn2016.GetFloat64(key02) + tkm.GetFloat64("grossamount")
		ratiosalesreturn2016.Set(key02, v)

	}

	masters.Set("ratiosalesreturn2016", ratiosalesreturn2016)
	masters.Set("mapsalesreturn2016", mapsalesreturn2016)
}

func prepmasterdiffsalesreturn2016() {
	toolkit.Println("--> Sales Return")
	mapsalesreturn2016 := masters.Get("mapsalesreturn2016").(toolkit.M)
	ratiosalesreturn2016 := masters.Get("ratiosalesreturn2016").(toolkit.M)

	csrsr, _ := conn.NewQuery().From("salestrxs-return").Select("fiscal", "month", "year", "grossamount", "customer", "product").
		Where(dbox.Eq("fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))).
		Cursor(nil)

	amount := float64(0)

	defer csrsr.Close()
	for {
		m := toolkit.M{}
		e := csrsr.Fetch(&m, 1, false)

		if e != nil {
			break
		}

		ctkm, _ := toolkit.ToM(m.Get("customer"))
		ptkm, _ := toolkit.ToM(m.Get("product"))

		//except RD in 2015-2016
		if ctkm.GetString("channelid") == "I1" {
			continue
		}

		key := toolkit.Sprintf("%s|%d|%d|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
			m.GetString("fiscal"), m.GetInt("month"), m.GetInt("year"),
			ctkm.GetString("branchid"), ctkm.GetString("branchname"), ctkm.GetString("keyaccount"),
			ctkm.GetString("channelid"), ctkm.GetString("channelname"), ctkm.GetString("reportchannel"),
			ctkm.GetString("reportsubchannel"), ctkm.GetString("zone"), ctkm.GetString("region"),
			ctkm.GetString("areaname"), ctkm.GetString("customergroup"), ctkm.GetString("customergroupname"),
			ctkm.GetString("custtype"), ptkm.GetString("brand"), "VDIST", "", "")

		if !mapsalesreturn2016.Has(key) {
			key = toolkit.Sprintf("%s|%s|%s|%s",
				m.GetString("fiscal"), ctkm.GetString("branchid"),
				ctkm.GetString("channelid"), ptkm.GetString("brand"))

			if !ratiosalesreturn2016.Has(key) {
				key = toolkit.Sprintf("%s|%s|%s",
					m.GetString("fiscal"), ctkm.GetString("branchid"),
					ctkm.GetString("channelid"))

				if !ratiosalesreturn2016.Has(key) {
					amount += m.GetFloat64("grossamount")
				}
			}

		}

		v := m.GetFloat64("grossamount") + mapsalesreturn2016.GetFloat64(key)
		mapsalesreturn2016.Set(key, v)

	}

	i := 0
	for k, v := range mapsalesreturn2016 {
		toolkit.Println(k, " : ", v)
		i++
		if i == 5 {
			break
		}
	}

	toolkit.Println("Amount not dist : ", amount)

	masters.Set("mapsalesreturn2016", mapsalesreturn2016)
}

func getstep(count int) int {
	v := count / 100
	if v == 0 {
		return 1
	}
	return v
}

func prepmastersgacalcrev() {
	toolkit.Println("--> SGA Rev Calculation")
	diffConn, _ := modules.GetDboxIConnection("db_godrej")
	defer diffConn.Close()

	m := map[string]map[string]*sgaalloc{}
	totalsga := float64(0)
	totalsgach := map[string]float64{}
	totalsalesch := map[string]float64{}

	filter := dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	sumnow, _ := diffConn.NewQuery().From("salespls-summary").
		Where(filter).
		Cursor(nil)
	// count := sumnow.Count()
	i := 0

	for {
		mnow := toolkit.M{}
		efetch := sumnow.Fetch(&mnow, 1, false)
		if efetch != nil {
			break
		}

		i++
		key := mnow.Get("key", toolkit.M{}).(toolkit.M)
		channelid := key.GetString("customer_channelid")
		mchannel, mchannelExist := m[channelid]
		if !mchannelExist {
			mchannel = map[string]*sgaalloc{}
			m[channelid] = mchannel
		}

		for sgakey, val := range mnow {
			if strings.Contains(sgakey, "PL33_") || strings.Contains(sgakey, "PL34_") || strings.Contains(sgakey, "PL35_") {
				cvalsga := toolkit.ToFloat64(val, 0, toolkit.RoundingAuto)

				totalsga += cvalsga
				totalsgach[channelid] += cvalsga

				dcsga, dcsgaexist := mchannel[sgakey]
				if !dcsgaexist {
					dcsga = new(sgaalloc)
					mchannel[sgakey] = dcsga
				}

				dcsga.TotalNow += cvalsga
				dcsga.TotalSales += mnow.GetFloat64("PL8A")
				totalsalesch[channelid] += mnow.GetFloat64("PL8A")
			}
		}
	}

	for chid, challocs := range m {
		totalchexpect := alloc[chid] * totalsga
		for _, dcsga := range challocs {
			dcsga.RatioNow = gdrj.SaveDiv(dcsga.TotalNow, totalsgach[chid])
			dcsga.TotalExpect = totalchexpect * gdrj.SaveDiv(dcsga.TotalSales, totalsalesch[chid])
		}
	}

	masters.Set("sgacalcrev", m)
}

func prepmastercustomergroup() {
	toolkit.Println("--> Customer Group Replace")

	filter := dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	csr, _ := conn.NewQuery().Select().Where(filter).From("salespls-summary-s12072016.v2").Cursor(nil)
	defer csr.Close()
	customergroup := toolkit.M{}
	customergroupname := toolkit.M{}

	for {
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			break
		}

		dtkm, _ := toolkit.ToM(tkm.Get("key"))

		customergroup.Set(tkm.GetString("_id"), dtkm.GetString("customer_customergroup"))
		customergroupname.Set(tkm.GetString("_id"), dtkm.GetString("customer_customergroupname"))
	}

	masters.Set("customergroup", customergroup)
	masters.Set("customergroupname", customergroupname)
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

	prepmastercustomergroup()

	// prepmastersgacalcrev()
	// prepmasterratiomapsalesreturn2016()
	// prepmasterdiffsalesreturn2016()
	// prepmastersalesreturn()
	// prepmasterratio()
	// prepmasterrevfreight()
	// prepmasterrevadv()

	toolkit.Println("Start data query...")
	filter := dbox.Eq("key.date_fiscal", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
	csr, _ := workerconn.NewQuery().Select().Where(filter).From("salespls-summary").Cursor(nil)
	defer csr.Close()

	scount = csr.Count()

	jobs := make(chan toolkit.M, scount)
	result := make(chan int, scount)
	for wi := 0; wi < 10; wi++ {
		go workersave(wi, jobs, result)
	}

	iscount = 0
	step := getstep(scount) * 5

	for {
		iscount++
		tkm := toolkit.M{}
		e := csr.Fetch(&tkm, 1, false)
		if e != nil {
			toolkit.Println("EOF")
			break
		}

		jobs <- tkm

		if iscount%step == 0 {
			toolkit.Printfn("Sending %d of %d (%d) in %s", iscount, scount, iscount*100/scount,
				time.Since(t0).String())
		}

	}

	close(jobs)

	for ri := 0; ri < scount; ri++ {
		<-result

		if ri%step == 0 {
			toolkit.Printfn("Saving %d of %d (%d pct) in %s",
				ri, scount, ri*100/scount, time.Since(t0).String())
		}
	}

	toolkit.Printfn("Processing done in %s",
		time.Since(t0).String())
}

func CleanAddCustomerGroupName(tkm toolkit.M) {
	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	dtkm.Set("customer_customergroupname", dtkm.GetString("customer_groupname"))
	dtkm.Set("customer_customergroup", dtkm.GetString("customer_group"))
	dtkm.Unset("customer_groupname")
	dtkm.Unset("customer_group")
	tkm.Set("key", dtkm)
}

func CalcRatio(tkm toolkit.M) {
	if !masters.Has("ratio") {
		return
	}

	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	ratio := masters.Get("ratio").(toolkit.M)

	rtkm := toolkit.M{}
	if tkm.Has("ratio") {
		rtkm = tkm["ratio"].(toolkit.M)
	}

	key := toolkit.Sprintf("%d_%d", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"))
	rtkm.Set("month", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	if dtkm.GetString("customer_channelid") != "EXP" {
		key = toolkit.Sprintf("ExEXP_%d_%d", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"))
		rtkm.Set("exexpmonth", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))
	}

	key = toolkit.Sprintf("%d_%d_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"), dtkm.GetString("product_brand"))
	rtkm.Set("monthbrand", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	key = toolkit.Sprintf("%d_%d_%s_%s_%s_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
		dtkm.GetString("customer_branchid"), dtkm.GetString("customer_channelid"),
		dtkm.GetString("customer_customergroup"), dtkm.GetString("product_brand"))
	rtkm.Set("monthbranchchannelcustgroupbrand", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	key = toolkit.Sprintf("%d_%d_%s_%s_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
		dtkm.GetString("customer_branchid"), dtkm.GetString("customer_channelid"),
		dtkm.GetString("customer_customergroup"))
	rtkm.Set("monthbranchchannelcustgroup", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	key = toolkit.Sprintf("%d_%d_%s_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
		dtkm.GetString("customer_branchid"), dtkm.GetString("customer_channelid"))
	rtkm.Set("monthbranchchannel", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	key = toolkit.Sprintf("%d_%d_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
		dtkm.GetString("customer_branchid"))
	rtkm.Set("monthbranch", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	key = toolkit.Sprintf("%d_%d_%s", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"),
		dtkm.GetString("customer_channelid"))
	rtkm.Set("monthchannel", (tkm.GetFloat64("grossamount") / ratio.GetFloat64(key)))

	tkm.Set("ratio", rtkm)
}

func CalcRoyalties(tkm toolkit.M) {
	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	netsales := tkm.GetFloat64("PL8A")

	if dtkm.GetString("date_fiscal") == "2015-2016" {
		tkm.Set("PL25", -netsales*0.0285214610603953)
	} else {
		tkm.Set("PL25", -netsales*0.0282568801711491)
	}
}

func CalcAdvertisementsRev(tkm toolkit.M) {
	if !masters.Has("advertisements") {
		return
	}

	tkm.Set("PL28", float64(0)).Set("PL28A", float64(0)).Set("PL28B", float64(0)).Set("PL28C", float64(0)).Set("PL28D", float64(0)).
		Set("PL28E", float64(0)).Set("PL28F", float64(0)).Set("PL28G", float64(0)).Set("PL28H", float64(0)).Set("PL28I", float64(0))

	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	dratio, _ := toolkit.ToM(tkm.Get("ratio"))

	advertisements := masters.Get("advertisements").(toolkit.M)

	tkm01 := toolkit.M{}
	tkm02 := toolkit.M{}

	key01 := toolkit.Sprintf("%d_%d", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"))
	if advertisements.Has(key01) {
		tkm01 = advertisements.Get(key01).(toolkit.M)
	}

	if len(dtkm.GetString("product_brand")) > 2 {
		key02 := toolkit.Sprintf("%s_%s", key01, strings.ToUpper(dtkm.GetString("product_brand")))
		if advertisements.Has(key02) {
			tkm02 = advertisements.Get(key02).(toolkit.M)
		}
	}

	for k, v := range tkm01 {
		fv := toolkit.ToFloat64(v, 6, toolkit.RoundingAuto) * -dratio.GetFloat64("month")
		fv += tkm.GetFloat64(k)
		tkm.Set(k, fv)
	}

	for k, v := range tkm02 {
		fv := toolkit.ToFloat64(v, 6, toolkit.RoundingAuto) * -dratio.GetFloat64("monthbrand")
		fv += tkm.GetFloat64(k)
		tkm.Set(k, fv)
	}

	return
}

func CalcFreightsRev(tkm toolkit.M) {
	if !masters.Has("freights") {
		return
	}

	tkm.Set("PL23", float64(0))

	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	dratio, _ := toolkit.ToM(tkm.Get("ratio"))

	freights := masters.Get("freights").(toolkit.M)
	key := toolkit.Sprintf("%d_%d", dtkm.GetInt("date_year"), dtkm.GetInt("date_month"))
	val := -dratio.GetFloat64("exexpmonth") * freights.GetFloat64(key)

	tkm.Set("PL23", val)
	return
}

func CleanUpdateCustomerGroupName(tkm toolkit.M) {
	customergroup := masters.Get("customergroup").(toolkit.M)
	customergroupname := masters.Get("customergroupname").(toolkit.M)

	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	dtkm.Set("customer_customergroupname", customergroupname.GetString(tkm.GetString("_id")))
	dtkm.Set("customer_customergroup", customergroup.GetString(tkm.GetString("_id")))
	tkm.Set("key", dtkm)
}

func CalcSalesReturn(tkm toolkit.M) {
	if !masters.Has("salesreturns") {
		return
	}

	tkm.Set("salesreturn", float64(0))

	dtkm, _ := toolkit.ToM(tkm.Get("key"))

	salesreturns := masters.Get("salesreturns").(toolkit.M)
	key := toolkit.Sprintf("%s|%d|%d|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
		dtkm.GetString("date_fiscal"), dtkm.GetInt("date_month"), dtkm.GetInt("date_year"),
		dtkm.GetString("customer_branchid"), dtkm.GetString("customer_branchname"), dtkm.GetString("customer_keyaccount"),
		dtkm.GetString("customer_channelid"), dtkm.GetString("customer_channelname"), dtkm.GetString("customer_reportchannel"),
		dtkm.GetString("customer_reportsubchannel"), dtkm.GetString("customer_zone"), dtkm.GetString("customer_region"),
		dtkm.GetString("customer_areaname"), dtkm.GetString("customer_customergroup"), dtkm.GetString("customer_customergroupname"),
		dtkm.GetString("customer_custtype"), dtkm.GetString("product_brand"), dtkm.GetString("trxsrc"),
		dtkm.GetString("source"), dtkm.GetString("ref"))

	// toolkit.Println(key)

	tkm.Set("salesreturn", salesreturns.GetFloat64(key))

	return
}

func CalcSalesReturn2016(tkm toolkit.M) {
	if !masters.Has("mapsalesreturn2016") || !masters.Has("ratiosalesreturn2016") {
		return
	}

	tkm.Set("salesreturn", float64(0)).Set("salesreturn_ori", float64(0))

	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	dratio, _ := toolkit.ToM(tkm.Get("ratio"))

	mapsalesreturn2016 := masters.Get("mapsalesreturn2016").(toolkit.M)
	ratiosalesreturn2016 := masters.Get("ratiosalesreturn2016").(toolkit.M)

	key := toolkit.Sprintf("%s|%d|%d|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s|%s",
		dtkm.GetString("date_fiscal"), dtkm.GetInt("date_month"), dtkm.GetInt("date_year"),
		dtkm.GetString("customer_branchid"), dtkm.GetString("customer_branchname"), dtkm.GetString("customer_keyaccount"),
		dtkm.GetString("customer_channelid"), dtkm.GetString("customer_channelname"), dtkm.GetString("customer_reportchannel"),
		dtkm.GetString("customer_reportsubchannel"), dtkm.GetString("customer_zone"), dtkm.GetString("customer_region"),
		dtkm.GetString("customer_areaname"), dtkm.GetString("customer_customergroup"), dtkm.GetString("customer_customergroupname"),
		dtkm.GetString("customer_custtype"), dtkm.GetString("product_brand"), dtkm.GetString("trxsrc"),
		dtkm.GetString("source"), dtkm.GetString("ref"))

	tkm.Set("salesreturn_ori", mapsalesreturn2016.GetFloat64(key))

	//Fiscal, Channels, Branches, Brands for 2016,
	key01 := toolkit.Sprintf("%s|%s|%s|%s",
		dtkm.GetString("date_fiscal"), dtkm.GetString("customer_branchid"),
		dtkm.GetString("customer_channelid"), dtkm.GetString("product_brand"))

	key02 := toolkit.Sprintf("%s|%s|%s",
		dtkm.GetString("date_fiscal"), dtkm.GetString("customer_branchid"),
		dtkm.GetString("customer_channelid"))

	dratio.Set("fiscalchannelbranchbrand", gdrj.SaveDiv(tkm.GetFloat64("grossamount"), ratiosalesreturn2016.GetFloat64(key01)))
	dratio.Set("fiscalchannelbranch", gdrj.SaveDiv(tkm.GetFloat64("grossamount"), ratiosalesreturn2016.GetFloat64(key02)))

	v := tkm.GetFloat64("salesreturn_ori")
	v += (mapsalesreturn2016.GetFloat64(key01) * dratio.GetFloat64("fiscalchannelbranchbrand"))
	v += (mapsalesreturn2016.GetFloat64(key02) * dratio.GetFloat64("fiscalchannelbranch"))

	tkm.Set("salesreturn", v)

	tkm.Set("ratio", dratio)

	return
}

func CalcSalesVDist20142015(tkm toolkit.M) {
	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	if dtkm.GetString("trxsrc") != "VDIST" || dtkm.GetString("date_fiscal") != "2014-2015" {
		return
	}

	if dtkm.GetString("customer_channelid") == "I1" {
		v := tkm.GetFloat64("discountamount")
		tkm.Set("PL8", -v)
	} else {
		v := tkm.GetFloat64("discountamount")
		tkm.Set("PL7", -v)
	}
}

func CalcSgaRev(tkm toolkit.M) {
	if !masters.Has("sgacalcrev") {
		return
	}

	dtkm, _ := toolkit.ToM(tkm.Get("key"))
	// dratio, _ := toolkit.ToM(tkm.Get("ratio"))

	gsgaratios := masters["sgacalcrev"].(map[string]map[string]*sgaalloc)
	gsgaratio := gsgaratios[dtkm.GetString("customer_channelid")]

	for sgakey, val := range tkm {
		if strings.Contains(sgakey, "PL33_") || strings.Contains(sgakey, "PL34_") || strings.Contains(sgakey, "PL35_") {
			sgadetail := gsgaratio[sgakey]
			cvalsga := toolkit.ToFloat64(val, 0, toolkit.RoundingAuto)
			cvalsga += (sgadetail.TotalExpect - sgadetail.TotalNow) * gdrj.SaveDiv(tkm.GetFloat64("PL8A"), sgadetail.TotalSales)
			tkm.Set(sgakey, cvalsga)
		}
	}
	return
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
		"PL44F", "PL6A", "PL0", "PL28", "PL29A", "PL31", "PL94A"}

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
		if k == "_id" || k == "key" {
			continue
		}

		ar01k := strings.Split(k, "_")

		if inexclude(ar01k[0]) {
			continue
		}

		plmodel, exist := plmodels[ar01k[0]]
		if !exist {
			// toolkit.Println(k)
			continue
		}
		Amount := toolkit.ToFloat64(v, 6, toolkit.RoundingAuto)
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
}

func workersave(wi int, jobs <-chan toolkit.M, result chan<- int) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()

	qSave := workerconn.NewQuery().
		From("salespls-summary-update").
		SetConfig("multiexec", true).
		Save()

	trx := toolkit.M{}
	for trx = range jobs {
		// CleanAddCustomerGroupName(trx)
		// CalcSalesReturn(trx)

		// CalcSalesReturn2016(trx)

		// CalcRatio(trx)
		// CalcFreightsRev(trx)

		// CalcAdvertisementsRev(trx)
		// CalcRoyalties(trx)
		// CalcSalesVDist20142015(trx)
		// CalcSgaRev(trx)

		CleanUpdateCustomerGroupName(trx)

		CalcSum(trx)

		err := qSave.Exec(toolkit.M{}.Set("data", trx))
		if err != nil {
			toolkit.Println(err)
		}

		result <- 1
	}
}
