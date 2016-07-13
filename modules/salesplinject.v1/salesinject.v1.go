package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"os"

	"strings"
	"sync"
	"time"

	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"

	"flag"
)

var mutex = new(sync.Mutex)
var conn dbox.IConnection

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
	masters    = toolkit.M{}
	t0         time.Time
	fiscalyear int
	customers  = toolkit.M{}
	branchs    = toolkit.M{}
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

func getCursor(obj orm.IModel) dbox.ICursor {
	c, e := gdrj.Find(obj,
		nil, nil)
	//toolkit.M{}.Set("take", 10))
	if e != nil {
		return nil
	}
	return c
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
	royalties, royaltiesamount, damages := map[string]float64{}, float64, map[string]float64{}
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
				agroup = "adv"
			} else if strings.Contains(o.Grouping, "SPG") {
				agroup = "spg"
			}

			key = toolkit.Sprintf("%s_%s", key, agroup)
			if agroup == "adv" {
				tadv, exist := promos[key]
				if !exist {
					tadv = toolkit.M{}
				}
				skey := "PL28I"
				tstr := strings.TrimSpace(o.AccountDescription)
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

				v := tadv.GetFloat64(skey) + o.AmountinIDR
				tadv.Set(skey, v)
				promos[key] = tadv
			} else if agroup == "spg" {
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
	toolkit.Printfn("Promos and spg : %v", subtot)

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
	cda, _ := conn.NewQuery().From("rawdatadiscountactivity_rev").Where(f).Cursor(nil)
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
	grossbymonthchannel, grossbymonthbrandchannel := toolkit.M{}, toolkit.M{}

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

	}

	masters.Set("globalgross", globalgross).Set("globalgrossvdist", globalgrossvdist)
	// tkm
	masters.Set("grossbybranch", grossbybranch).Set("grossbybrand", grossbybrand).Set("grossbysku", grossbysku).Set("grossbychannel", grossbychannel)
	masters.Set("grossbymonth", grossbymonth).Set("grossbymonthvdist", grossbymonthvdist).Set("grossbymonthsku", grossbymonthsku).
		Set("grossbymonthchannel", grossbymonthchannel).Set("grossbymonthbrandchannel", grossbymonthbrandchannel)
}

func main() {

	t0 = time.Now()
	flag.IntVar(&fiscalyear, "year", 2015, "fiscal year to process. default is 2015")
	flag.Parse()

	eperiode := time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	speriode := eperiode.AddDate(-1, 0, 0)

	setinitialconnection()
	defer gdrj.CloseDb()

	var f *dbox.Filter
	// f = dbox.And(dbox.Gte("date", speriode), dbox.Lt("date", eperiode), dbox.Eq("customervalid", true), dbox.Ne("src", "DISCOUNT"))
	f = dbox.And(dbox.Gte("date", speriode), dbox.Lt("date", eperiode), dbox.Ne("src", "DISCOUNT"))
	// f = dbox.And(dbox.Gte("date", speriode), dbox.Lt("date", eperiode))
	// f = dbox.Or(dbox.Eq("_id", "RD_2014_4_40007354_24260"),dbox.Eq("_id", "EXPORT_2014_4_40007767_13"),dbox.Eq("_id", "VDIST/2015-2014/FK/IPR/14003129_CD04_2"))

	toolkit.Printfn("Prepare : %v", t0)
	prepmasterclean()
	prepmastergrossproc()
	prepmastercalc()

	toolkit.Printfn("Run : %v", t0)

	c, _ := gdrj.Find(new(gdrj.SalesTrx), f, nil)
	defer c.Close()

	count := c.Count()
	jobs := make(chan *gdrj.SalesTrx, count)
	result := make(chan string, count)
	for wi := 0; wi < 25; wi++ {
		go workerproc(wi, jobs, result)
	}

	step := count / 100
	if step == 0 {
		step = 10
	}

	i := 0
	toolkit.Printfn("START ... %d records ", count)
	for {
		stx := new(gdrj.SalesTrx)
		e := c.Fetch(stx, 1, false)
		if e != nil {
			break
		}

		if strings.ToUpper(stx.Src) == "DISCOUNT" {
			continue
		}

		if i == 25 {
			break
		}

		i++
		jobs <- stx
		if i%step == 0 {
			toolkit.Printfn("Sending %d of %d (%d) in %s",
				i, count, i/step,
				time.Since(t0).String())
		}
	}

	close(jobs)

	for ri := 0; ri < i; ri++ {
		<-result

		if ri%step == 0 {
			toolkit.Printfn("Saving %d of %d (%d pct) in %s",
				ri, count, ri/step, time.Since(t0).String())
		}
	}
}

func workerproc(wi int, jobs <-chan *gdrj.SalesTrx, result chan<- string) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()

	trx := new(gdrj.SalesTrx)
	for trx = range jobs {
		pl := new(gdrj.SalesPL)

		pl.ID = trx.ID
		pl.SKUID = trx.SKUID
		pl.SKUID_VDIST = trx.SKUID_VDIST
		pl.OutletID = trx.OutletID

		pl.Date = gdrj.SetDate(trx.Date)

		pl.SalesQty = trx.SalesQty
		pl.GrossAmount = trx.GrossAmount
		pl.DiscountAmount = trx.DiscountAmount
		pl.TaxAmount = trx.TaxAmount

		pl.Customer = trx.Customer
		pl.Product = trx.Product
		pl.TrxSrc = trx.Src

		pl.CleanAndClasify(masters)
		pl.RatioCalc(masters)

		//calculate process -- better not re-run
		pl.CalcCOGSRev(masters) //check	0 value

		pl.CalcSGARev(masters)

		//calculate process
		pl.CalcFreight(masters)
		pl.CalcDepre(masters)
		pl.CalcDamage(masters)
		pl.CalcDepre(masters)
		pl.CalcRoyalties(masters)
		pl.CalcDiscountActivity(masters) //check 0 value
		pl.CalcPromo(masters)
		pl.CalcSum(masters)

		pl.CalcSales(masters)
		pl.CalcSum(masters)

		tablename := toolkit.Sprintf("%v-1", pl.TableName())
		workerconn.NewQuery().From(tablename).
			Save().Exec(toolkit.M{}.Set("data", pl))

		result <- pl.ID
	}
}
