package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"sync"
	"time"

	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"

	"flag"
	"strings"
)

var mutex = new(sync.Mutex)
var conn dbox.IConnection
var (
	compute              string
	periodFrom, periodTo int
	dateFrom, dateTo     time.Time
	fiscalyear           int
	gtablename           = "salespls-2016"
	stablename           = "salespls-2016"
)
var masters = toolkit.M{}

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

func getCursor(obj orm.IModel) dbox.ICursor {
	c, e := gdrj.Find(obj,
		nil, nil)
	if e != nil {
		return nil
	}
	return c
}

var subchannels = toolkit.M{}

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

func prepmaster() {

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

func prepmastercalc() {
	//HBrandCategory
	toolkit.Println("--> BRAND Category")
	tkmbrandcategory := toolkit.M{}
	chbc := getCursor(new(gdrj.HBrandCategory))
	defer chbc.Close()
	for {
		hbc := new(gdrj.HBrandCategory)
		err := chbc.Fetch(hbc, 1, false)
		if err != nil {
			break
		}

		if len(hbc.BrandID) < 3 {
			continue
		}

		tkmbrandcategory.Set(hbc.ID, hbc.BrandID)
	}

	//Cost Center Data
	ccs := buildmap(map[string]*gdrj.CostCenter{},
		func() orm.IModel {
			return new(gdrj.CostCenter)
		},
		nil,
		func(holder, obj interface{}) {
			h := holder.(map[string]*gdrj.CostCenter)
			o := obj.(*gdrj.CostCenter)
			h[o.ID] = o
		}).(map[string]*gdrj.CostCenter)
	masters.Set("costcenter", ccs)

	f := dbox.Eq("year", fiscalyear-1)
	toolkit.Println("--> COGS")
	//maps for key
	cogskeys := make(map[string]int, 0)
	csr01, _ := conn.NewQuery().From("salestrxs-grossproc").Cursor(nil)
	defer csr01.Close()
	for {
		m := toolkit.M{}
		e := csr01.Fetch(&m, 1, false)
		if e != nil {
			break
		}

		if len(m.GetString("skuid")) > 2 {
			key := toolkit.Sprintf("%d_%d_%s", m.GetInt("year"), m.GetInt("month"), m.GetString("skuid"))
			cogskeys[key] = 1
		}
	}

	cogsmaps := make(map[string]*gdrj.COGSConsolidate, 0)
	ccogs, _ := gdrj.Find(new(gdrj.COGSConsolidate), nil, nil)
	defer ccogs.Close()

	for {
		o := new(gdrj.COGSConsolidate)
		e := ccogs.Fetch(o, 1, false)
		if e != nil {
			break
		}

		key := toolkit.Sprintf("%d_%d_%s", o.Year, int(o.Month), o.SAPCode)
		_, exist := cogskeys[key]
		if !exist {
			key = toolkit.Sprintf("%d_%d", o.Year, int(o.Month))
		}

		cog, exist := cogsmaps[key]
		if !exist {
			cog = new(gdrj.COGSConsolidate)
		}

		cog.Year = o.Year
		cog.Month = o.Month
		cog.COGS_Amount += o.COGS_Amount
		cog.RM_Amount += o.RM_Amount
		cog.LC_Amount += o.LC_Amount
		cog.PF_Amount += o.PF_Amount
		cog.Depre_Amount += o.Depre_Amount

		cogsmaps[key] = cog
	}
	masters.Set("cogs", cogsmaps)

	subtot := float64(0)
	for _, v := range cogsmaps {
		date := time.Date(v.Year, time.Month(v.Month), 1, 0, 0, 0, 0, time.UTC).AddDate(0, -3, 0)
		if date.Year() == fiscalyear-1 {
			subtot += v.COGS_Amount
		}
	}
	toolkit.Printfn("COGS : %v", subtot)

	toolkit.Println("--> RAW DATA PL")
	promos, freight, depreciation := map[string]toolkit.M{}, map[string]*gdrj.RawDataPL{}, map[string]float64{}
	royalties, royaltiesamount, damages := map[string]float64{}, float64(0), map[string]float64{}
	sgapls := map[string]toolkit.M{}

	csrpromo, _ := gdrj.Find(new(gdrj.RawDataPL), f, nil)
	defer csrpromo.Close()

	for {
		o := new(gdrj.RawDataPL)
		e := csrpromo.Fetch(o, 1, false)
		if e != nil {
			break
		}

		Date := time.Date(o.Year, time.Month(o.Period), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 3, 0)
		key := toolkit.Sprintf("%d_%d", Date.Year(), Date.Month())

		switch o.Src {
		case "APROMO":
			agroup := "promo"
			if strings.Contains(o.Grouping, "Advertising") {
				continue
				// agroup = "adv"
			} else if strings.Contains(o.Grouping, "SPG") {
				agroup = "spg"
			}

			key = toolkit.Sprintf("%s_%s", key, agroup)
			// if agroup == "adv" {
			// 	tadv, exist := promos[key]
			// 	if !exist {
			// 		tadv = toolkit.M{}
			// 	}
			// 	skey := "PL28I"
			// 	tstr := strings.TrimSpace(o.AccountDescription)
			// 	switch tstr {
			// 	case "ADVERTISEMENT - INTERNET":
			// 		skey = "PL28A"
			// 	case "ADVERTISEMENT - PRODN - DESIGN - DVLOPMNT":
			// 		skey = "PL28B"
			// 	case "ADVERTISEMENT - TV":
			// 		skey = "PL28C"
			// 	case "MARKET RESEARCH":
			// 		skey = "PL28D"
			// 	case "FAIRS & EVENTS":
			// 		skey = "PL28E"
			// 	case "AGENCY FEES":
			// 		skey = "PL28F"
			// 	case "ADVERTISEMENT - POP MATERIALS":
			// 		skey = "PL28G"
			// 	case "SPONSORSHIP":
			// 		skey = "PL28H"
			// 	}

			// 	v := tadv.GetFloat64(skey) + o.AmountinIDR
			// 	tadv.Set(skey, v)
			// 	promos[key] = tadv
			// } else
			if agroup == "spg" {
				tspg, exist := promos[key]
				if !exist {
					tspg = toolkit.M{}
				}

				skey := "PL31E"
				tstr := strings.ToUpper(strings.TrimSpace(o.AccountDescription))
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

				v := tspg.GetFloat64(skey) + o.AmountinIDR
				tspg.Set(skey, v)
				promos[key] = tspg
			} else {
				tpromo, exist := promos[key]
				if !exist {
					tpromo = toolkit.M{}
				}

				tstr := strings.TrimSpace(o.AccountDescription)
				plmodels := masters.Get("plmodel").(map[string]*gdrj.PLModel)
				skey := "PL29A32"
				for _, v := range plmodels {
					if v.PLHeader2 == "Promotions Expenses" && v.PLHeader3 == tstr {
						skey = v.ID
					}
				}

				v := tpromo.GetFloat64(skey) + o.AmountinIDR
				tpromo.Set(skey, v)
				promos[key] = tpromo
			}
		case "FREIGHT":
			frg, exist := freight[key]
			if !exist {
				frg = new(gdrj.RawDataPL)
			}
			frg.AmountinIDR += o.AmountinIDR
			freight[key] = frg
		case "ROYALTY":
			royalties[key] += o.AmountinIDR
			royaltiesamount += o.AmountinIDR
		case "DEPRECIATION":
			dgroup := "indirect"
			if strings.Contains(o.Grouping, "Factory") {
				dgroup = "direct"
			}
			key := toolkit.Sprintf("%s_%s", key, dgroup)
			depreciation[key] += o.AmountinIDR
		case "DAMAGEGOODS": //2015-2016
			key = toolkit.Sprintf("%s", toolkit.Sprintf("%d-%d", fiscalyear-1, fiscalyear))
			damages[key] += o.AmountinIDR
		case "SGAPL":
			tsga, exist := sgapls[key]
			if !exist {
				tsga = toolkit.M{}
			}

			subkey := "PL33"
			if strings.Contains(o.Grouping, "administrative") || strings.Contains(o.Grouping, "General") {
				subkey = "PL34"
			} else if strings.Contains(o.Grouping, "Depr") {
				subkey = "PL35"
			}

			group := ""
			cc, exist := ccs[o.CCID]
			if exist {
				group = cc.CostGroup01
			}

			if group == "" {
				group = "Other"
			}

			subkey = toolkit.Sprintf("%s_%s", subkey, group)

			val := tsga.GetFloat64(subkey) + o.AmountinIDR
			tsga.Set(subkey, val)
			sgapls[key] = tsga
			//Personnel  Expense - Office	PL33
			//General and administrative expenses	PL34
			// & Amort. Exp. -  Office	PL35
		}
	}

	toolkit.Println("--> Rev. Advertisement")
	//maps for key
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
		agroup := "adv"
		// key := toolkit.Sprintf("%d_%d", Date.Year(), Date.Month())
		key := toolkit.Sprintf("%d_%d_%s", m.GetInt("year"), m.GetInt("period"), "adv")
		if len(m.GetString("brand")) > 2 {
			key = toolkit.Sprintf("%d_%d_%s_%s",
				m.GetInt("year"),
				m.GetInt("period"),
				strings.TrimSpace(strings.ToUpper(m.GetString("brand"))),
				"adv")
		}

		if agroup == "adv" {
			tadv, exist := promos[key]
			if !exist {
				tadv = toolkit.M{}
			}
			skey := "PL28I"
			tstr := strings.TrimSpace(m.GetString("accountdescription"))
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
			promos[key] = tadv
		}

	}

	subtot = float64(0)
	for _, v := range royalties {
		subtot += v
	}
	toolkit.Printfn("Royaties : %v", subtot)

	subtot = float64(0)
	for _, v := range damages {
		subtot += v
	}
	toolkit.Printfn("Damages : %v", subtot)

	subtot = float64(0)
	for _, v := range depreciation {
		subtot += v
	}
	toolkit.Printfn("Depreciation : %v", subtot)

	// subtot = float64(0)
	// for _, v := range promos {
	// 	subtot += v
	// }
	// toolkit.Printfn("Adv, Promos and spg : %v", subtot)

	subtot = float64(0)
	for _, v := range promos {
		for _, xv := range v {
			subtot += toolkit.ToFloat64(xv, 6, toolkit.RoundingAuto)
		}
	}
	toolkit.Printfn("Adv, Promos and spg : %v", subtot)

	subtot = float64(0)
	for _, v := range sgapls {
		for _, xv := range v {
			subtot += toolkit.ToFloat64(xv, 6, toolkit.RoundingAuto)
		}
	}
	toolkit.Printfn("SGA : %v", subtot)

	masters.Set("promos", promos).Set("freight", freight).Set("depreciation", depreciation).
		Set("royalties", royalties).Set("damages", damages).Set("sgapls", sgapls).Set("royaltiesamount", royaltiesamount)

	toolkit.Println("--> DISCOUNT ACTIVITY")
	//discounts_all discounts
	//can be by brach,brand,channelid,month
	cda, _ := conn.NewQuery().From("rawdiscountact_29062016").Where(f).Cursor(nil)
	defer cda.Close()
	chlist := []string{"I1", "I2", "I3", "I4", "I6", "EXP"}
	inarrstr := func(arrstr []string, str string) bool {
		for _, v := range arrstr {
			if v == str {
				return true
			}
		}
		return false
	}

	tkmdiscount := toolkit.M{}
	for {
		m := toolkit.M{}
		e := cda.Fetch(&m, 1, false)
		if e != nil {
			break
		}
		date := time.Date(m.GetInt("year"), time.Month(m.GetInt("period")), 1, 0, 0, 0, 0, time.UTC).AddDate(0, 3, 0)
		ch := strings.ToUpper(m.GetString("channel"))
		if !inarrstr(chlist, ch) {
			ch = "I2"
		}

		key := toolkit.Sprintf("%d_%d_%s", date.Year(), date.Month(), ch)
		ln := len(m.GetString("pcid"))
		brand := ""
		if ln >= 7 {
			brand = strings.ToUpper(tkmbrandcategory.GetString(m.GetString("pcid")[(ln - 3):ln]))
		}

		if len(brand) > 2 {
			key = toolkit.Sprintf("%s_%s", key, brand)
		}

		tamount := tkmdiscount.GetFloat64(key) + m.GetFloat64("amountinidr")
		tkmdiscount.Set(key, tamount)
	}
	masters.Set("discounts", tkmdiscount)

	subtot = 0
	for _, v := range tkmdiscount {
		subtot += toolkit.ToFloat64(v, 6, toolkit.RoundingAuto)
	}
	toolkit.Printfn("Discount Activity : %v", subtot)
}

func prepmasterclean() {

	toolkit.Println("--> Sub Channel")
	csr, _ := conn.NewQuery().From("subchannels").Cursor(nil)
	subchannels := toolkit.M{}
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

	rdlocations := toolkit.M{}
	crdloc, _ := conn.NewQuery().From("outletgeo").Cursor(nil)
	defer crdloc.Close()
	for {
		stx := toolkit.M{}
		e := crdloc.Fetch(&stx, 1, false)
		if e != nil {
			break
		}

		rdlocations.Set(stx.GetString("_id"), stx)
	}
	masters.Set("rdlocations", rdlocations)
}

func prepmastergrossproc() {

	globalgross, globalgrossvdist := float64(0), float64(0)
	grossbybranch, grossbybrand, grossbysku, grossbychannel := toolkit.M{}, toolkit.M{}, toolkit.M{}, toolkit.M{}
	grossbymonthvdist, grossbymonth, grossbymonthsku := toolkit.M{}, toolkit.M{}, toolkit.M{}
	grossbymonthchannel, grossbymonthbrandchannel, grossbymonthbrand := toolkit.M{}, toolkit.M{}, toolkit.M{}

	toolkit.Println("--> Trx Gross Proc")
	csr01, _ := conn.NewQuery().From("salestrxs-grossproc").
		Where(dbox.Ne("src", "DISCOUNT")).
		// Where(dbox.And(dbox.Eq("custcheck", true), dbox.Ne("src", "DISCOUNT"))).
		Cursor(nil)
	defer csr01.Close()
	for {
		m := toolkit.M{}
		e := csr01.Fetch(&m, 1, false)
		if e != nil {
			break
		}

		if strings.ToUpper(m.GetString("src")) == "DISCOUNT" {
			continue
		}

		agross := m.GetFloat64("gross")
		globalgross += agross
		if strings.ToUpper(m.GetString("src")) == "VDIST" {
			globalgrossvdist += agross
		}

		key := toolkit.Sprintf("%s", m.GetString("brand"))
		tempval := grossbybrand.GetFloat64(key) + agross
		grossbybrand.Set(key, tempval)

		key = toolkit.Sprintf("%s", m.GetString("branchid"))
		tempval = grossbybranch.GetFloat64(key) + agross
		grossbybranch.Set(key, tempval)

		key = toolkit.Sprintf("%s", m.GetString("skuid"))
		tempval = grossbysku.GetFloat64(key) + agross
		grossbysku.Set(key, tempval)

		key = toolkit.Sprintf("%s", m.GetString("channelcheck"))
		tempval = grossbychannel.GetFloat64(key) + agross
		grossbychannel.Set(key, tempval)

		key = toolkit.Sprintf("%d_%d", m.GetInt("year"), m.GetInt("month"))
		tempval = grossbymonth.GetFloat64(key) + agross
		grossbymonth.Set(key, tempval)

		if strings.ToUpper(m.GetString("src")) == "VDIST" {
			key = toolkit.Sprintf("%d_%d", m.GetInt("year"), m.GetInt("month"))
			tempval = grossbymonthvdist.GetFloat64(key) + agross
			grossbymonthvdist.Set(key, tempval)
		}

		key = toolkit.Sprintf("%d_%d_%s", m.GetInt("year"), m.GetInt("month"), m.GetString("skuid"))
		tempval = grossbymonthsku.GetFloat64(key) + agross
		grossbymonthsku.Set(key, tempval)

		key = toolkit.Sprintf("%d_%d_%s", m.GetInt("year"), m.GetInt("month"), m.GetString("channelcheck"))
		tempval = grossbymonthchannel.GetFloat64(key) + agross
		grossbymonthchannel.Set(key, tempval)

		key = toolkit.Sprintf("%d_%d_%s_%s", m.GetInt("year"), m.GetInt("month"), m.GetString("brand"), m.GetString("channelcheck"))
		tempval = grossbymonthbrandchannel.GetFloat64(key) + agross
		grossbymonthbrandchannel.Set(key, tempval)

		key = toolkit.Sprintf("%d_%d_%s", m.GetInt("year"), m.GetInt("month"), m.GetString("brand"))
		tempval = grossbymonthbrand.GetFloat64(key) + agross
		grossbymonthbrand.Set(key, tempval)

	}

	masters.Set("globalgross", globalgross).Set("globalgrossvdist", globalgrossvdist)
	// tkm
	masters.Set("grossbybranch", grossbybranch).Set("grossbybrand", grossbybrand).Set("grossbysku", grossbysku).Set("grossbychannel", grossbychannel)
	masters.Set("grossbymonth", grossbymonth).Set("grossbymonthvdist", grossbymonthvdist).Set("grossbymonthsku", grossbymonthsku).
		Set("grossbymonthchannel", grossbymonthchannel).Set("grossbymonthbrandchannel", grossbymonthbrandchannel).
		Set("grossbymonthbrand", grossbymonthbrand)
}

var pldatas = map[string]*gdrj.PLDataModel{}
var t0 time.Time

func main() {

	t0 = time.Now()
	flag.IntVar(&fiscalyear, "year", 2016, "fiscal year to process. default is 2015")
	flag.Parse()

	eperiode := time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	speriode := eperiode.AddDate(-1, 0, 0)
	speriode = eperiode.AddDate(0, 0, -1)
	stablename = "salespls-1"

	setinitialconnection()
	defer gdrj.CloseDb()

	seeds := make([]time.Time, 0, 0)
	seeds = append(seeds, speriode)
	for {
		speriode = speriode.AddDate(0, 0, 1)
		if !speriode.Before(eperiode) {
			break
		}
		seeds = append(seeds, speriode)
	}

	toolkit.Println("Reading Master")

	prepmaster()
	// prepmastergrossproc()
	// prepmasterclean()
	// prepmastercalc()

	getresult := make(chan int, len(seeds))
	toolkit.Println("Starting worker query...")
	ix := 0
	for _, v := range seeds {
		ix++
		filter := dbox.Eq("date.date", v)
		go workerproc(ix, filter, getresult)
	}

	toolkit.Println("Waiting result query... : ", ix)
	for i := 1; i <= ix; i++ {
		n := <-getresult
		toolkit.Printfn("Saving %d of %d (%d pct) in %s : %d",
			i, ix, i*100/ix, time.Since(t0).String(), n)
	}

	toolkit.Printfn("All done in %s", time.Since(t0).String())
}

func workerproc(wi int, filter *dbox.Filter, getresult chan<- int) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()

	csr, _ := workerconn.NewQuery().Select().
		From(gtablename).
		Where(filter).
		Cursor(nil)

	i := 0
	qSave := workerconn.NewQuery().
		From(stablename).
		SetConfig("multiexec", true).
		Save()

	for {
		i++
		spl := new(gdrj.SalesPL)
		e := csr.Fetch(spl, 1, false)
		if e != nil {
			// toolkit.Println("FETCH : ", e)
			break
		}

		// spl.CleanAndClasify(masters)
		spl.CalcSales(masters)
		// 		// === For ratio update and calc
		// spl.RatioCalc(masters)

		// 		//calculate process -- better not re-run
		// 		// spl.CalcCOGSRev(masters)

		// 		//calculate process
		// 		// spl.CalcFreight(masters)
		// 		// spl.CalcDepre(masters)
		// spl.CalcDamage(masters)
		// spl.CalcDepre(masters)
		// spl.CalcDiscountActivity(masters)
		// spl.CalcPromo(masters)
		spl.CalcRoyalties2016(masters)
		spl.CalcSum(masters)

		err := qSave.Exec(toolkit.M{}.Set("data", spl))
		if err != nil {
			toolkit.Printfn("Save data : %v", err)
		}
		// workerconn.NewQuery().From(tablename).
		// 	Save().Exec(toolkit.M{}.Set("data", spl))
	}

	getresult <- csr.Count()

}
