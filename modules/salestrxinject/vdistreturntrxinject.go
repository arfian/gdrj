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
	"sync"
	"time"
)

var conn dbox.IConnection
var count, step, fiscalyear int
var vdistdetail string
var vdistheader string
var mutex *sync.Mutex
var eperiode, speriode time.Time
var ggrossamount, cggrossamount float64

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
	shs           = toolkit.M{}
	shs11         = toolkit.M{}
	sgrossamount  = toolkit.M{}
	pcs           = toolkit.M{}
	ccs           = toolkit.M{}
	ledgers       = toolkit.M{}
	prods         = toolkit.M{}
	custs         = toolkit.M{}
	vdistskus     = toolkit.M{}
	mapskuids     = toolkit.M{}
	lastSalesLine = toolkit.M{}
	masters       = toolkit.M{}
)

var mwg sync.WaitGroup

func getCursor(obj orm.IModel) dbox.ICursor {
	c, e := gdrj.Find(obj, nil, nil)
	if e != nil {
		return nil
	}
	return c
}

func prepMaster() {
	pc := new(gdrj.ProfitCenter)
	cc := new(gdrj.CostCenter)
	prod := new(gdrj.Product)
	ledger := new(gdrj.LedgerMaster)

	var e error

	cpc := getCursor(pc)
	defer cpc.Close()
	for e = cpc.Fetch(pc, 1, false); e == nil; {
		pcs.Set(pc.ID, pc)
		pc = new(gdrj.ProfitCenter)
		e = cpc.Fetch(pc, 1, false)
	}

	ccc := getCursor(cc)
	defer ccc.Close()
	for e = ccc.Fetch(cc, 1, false); e == nil; {
		ccs.Set(cc.ID, cc)
		cc = new(gdrj.CostCenter)
		e = ccc.Fetch(cc, 1, false)
	}

	cprod := getCursor(prod)
	defer cprod.Close()
	for e = cprod.Fetch(prod, 1, false); e == nil; {
		prods.Set(prod.ID, prod)
		prod = new(gdrj.Product)
		e = cprod.Fetch(prod, 1, false)
	}

	cledger := getCursor(ledger)
	defer cledger.Close()
	for e = cledger.Fetch(ledger, 1, false); e == nil; {
		ledgers.Set(ledger.ID, ledger)
		ledger = new(gdrj.LedgerMaster)
		e = cledger.Fetch(ledger, 1, false)
	}

	cust := new(gdrj.Customer)
	ccust := getCursor(cust)
	defer ccust.Close()
	for e = ccust.Fetch(cust, 1, false); e == nil; {
		custs.Set(strings.ToUpper(cust.ID), cust)
		cust = new(gdrj.Customer)
		e = ccust.Fetch(cust, 1, false)
	}

	sku := new(gdrj.MappingInventory)
	cskus := getCursor(sku)
	defer cskus.Close()
	for e = cskus.Fetch(sku, 1, false); e == nil; {
		vdistskus.Set(sku.SKUID_VDIST, sku.ID)
		sku = new(gdrj.MappingInventory)
		e = cskus.Fetch(sku, 1, false)
	}

	/*tname := toolkit.Sprintf("%s_grossproc", vdistdetail)
	cgross, _ := conn.NewQuery().Select().From(tname).Cursor(nil)
	defer cgross.Close()

	for {
		tkmcrsh := new(toolkit.M)
		e := cgross.Fetch(tkmcrsh, 1, false)
		if e != nil {
			break
		}

		ivid := toolkit.Sprintf("%s_%s", tkmcrsh.Get("invoice", ""), tkmcrsh.Get("branch", ""))
		if ivid != "" {
			sgrossamount.Set(ivid, toolkit.ToFloat64(tkmcrsh.Get("grossamount", 0), 6, toolkit.RoundingAuto))
		}
	}

	toolkit.Println(sgrossamount)*/
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

func main() {
	setinitialconnection()
	defer gdrj.CloseDb()
	mutex = &sync.Mutex{}

	flag.StringVar(&vdistdetail, "vdistdetail", "rawsalesreturn1415", "vdistdetail representation of collection vdist detail that want to be processed. Default is blank")
	flag.IntVar(&fiscalyear, "year", 2015, "fiscal year to process. Default is 2015")
	flag.Parse()

	eperiode = time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC)
	speriode = eperiode.AddDate(-1, 0, 0)

	toolkit.Println("Reading Master")
	prepMaster()
	prepmasterclean()

	toolkit.Println("START...")

	xconn, _ := modules.GetDboxIConnection("db_godrej")
	filter := dbox.Eq("month", 1)
	crx, _ := xconn.NewQuery().Select().Where(filter).From(vdistdetail).Cursor(nil)
	// crx, _ := conn.NewQuery().Select().From(vdistdetail).Cursor(nil)
	defer crx.Close()
	defer xconn.Close()

	lastSalesLine = toolkit.M{}
	count = crx.Count()
	step = count / 100
	i := 0

	jobs := make(chan *gdrj.SalesTrx, count)
	result := make(chan string, count)
	for wi := 0; wi < 10; wi++ {
		mwg.Add(1)
		go workerProc(wi, jobs, result)
	}

	t0 := time.Now()
	for {
		i++
		tkmsd := new(toolkit.M)
		e := crx.Fetch(&tkmsd, 1, false)
		if e != nil {
			break
		}

		gdrjdate := new(gdrj.Date)
		st := new(gdrj.SalesTrx)

		st.SalesHeaderID = toolkit.Sprintf("%s_%s", tkmsd.Get("iv_no", ""), tkmsd.Get("brsap", ""))

		if st.SalesHeaderID == "" {
			st.SalesHeaderID = toolkit.Sprintf("OTHER/03/%d-%d_CD00", fiscalyear-1, fiscalyear)
		}

		if lastSalesLine.Has(st.SalesHeaderID) {
			lastLineNo := lastSalesLine.GetInt(st.SalesHeaderID) + 1
			st.LineNo = lastLineNo
			lastSalesLine.Set(st.SalesHeaderID, lastLineNo)
		} else {
			st.LineNo = 1
			lastSalesLine.Set(st.SalesHeaderID, 1)
		}

		dgrossamount := tkmsd.GetFloat64("gross")
		ggrossamount += dgrossamount

		// asgrossamount := sgrossamount.GetFloat64(st.SalesHeaderID)

		st.HeaderValid = true
		st.OutletID = toolkit.Sprintf("%s%s", tkmsd.GetString("brsap"), strings.ToUpper(tkmsd.GetString("outletid")))

		// ddisc := toolkit.ToFloat64(tkmsd.Get("disc", 0), 6, toolkit.RoundingAuto)
		// if ddisc != 0 && asgrossamount != 0 {
		// 	st.DiscountAmount = dgrossamount * ddisc / asgrossamount
		// }

		// dvppn := toolkit.ToFloat64(tkmsd.Get("ivppn", 0), 6, toolkit.RoundingAuto)
		// if dvppn != 0 && asgrossamount != 0 {
		// 	st.TaxAmount = dgrossamount * dvppn / asgrossamount
		// }

		st.Date = time.Date(tkmsd.GetInt("year"), time.Month(tkmsd.GetInt("month")), tkmsd.GetInt("day"), 0, 0, 0, 0, time.UTC)

		if st.Date.IsZero() {
			st.Date = time.Date(fiscalyear, 4, 1, 0, 0, 0, 0, time.UTC).AddDate(0, 0, -1)
		}

		gdrjdate = gdrj.SetDate(st.Date)
		st.Year = gdrjdate.Year
		st.Month = int(gdrjdate.Month)
		st.Fiscal = gdrjdate.Fiscal

		//brsap,iv_no,dtsales,inv_no,qty,price,gross,net
		st.SKUID_VDIST = tkmsd.GetString("inv_no")
		if vdistskus.Has(st.SKUID_VDIST) {
			st.SKUID = vdistskus.GetString(st.SKUID_VDIST)
		} else {
			st.SKUID = "not found"
		}

		st.SalesQty = tkmsd.GetFloat64("qty")
		st.GrossAmount = dgrossamount
		st.NetAmount = tkmsd.GetFloat64("net")

		if prods.Has(st.SKUID) {
			st.ProductValid = true
			st.Product = prods.Get(st.SKUID).(*gdrj.Product)
		} else {
			st.Product = new(gdrj.Product)
			st.Product.Brand = "OTHER"
			st.Product.Name = "OTHER"
			st.ProductValid = false
		}

		st.Customer, st.CustomerValid = getcustomerclean(st.OutletID)
		// if custs.Has(st.OutletID) {
		// 	st.CustomerValid = true
		// 	st.Customer = custs.Get(st.OutletID).(*gdrj.Customer)
		// 	// if st.Customer.ChannelID == "I1" {
		// 	// 	st.CustomerValid = false
		// 	// }
		// } else {
		// 	st.CustomerValid = false
		// }

		if st.ProductValid && st.CustomerValid {
			pcid := st.Customer.BranchID + st.Product.BrandCategoryID
			if pcs.Has(pcid) {
				st.PCValid = true
				st.PC = pcs.Get(pcid).(*gdrj.ProfitCenter)
			} else {
				st.PCValid = false
			}
		} else {
			st.PCValid = false
		}

		if st.CustomerValid && st.HeaderValid {
			cggrossamount += st.GrossAmount
		}

		st.Src = "VDIST"
		st.ID = toolkit.Sprintf("VDIST/%d-%d/%v_%d", fiscalyear-1, fiscalyear, st.SalesHeaderID, st.LineNo)

		jobs <- st

		if step == 0 {
			step = 100
		}

		if i%step == 0 {
			toolkit.Printfn("Processing %d of %d (%d) in %s",
				i, count, i/step,
				time.Since(t0).String())
		}
	}

	close(jobs)

	for ri := 0; ri < i; ri++ {
		ri++
		<-result
		if step == 0 {
			step = 100
		}

		if ri%step == 0 {
			toolkit.Printfn("Saving %d of %d (%d pct) in %s",
				ri, count, ri/step, time.Since(t0).String())
		}
	}

	mwg.Wait()

	toolkit.Printfn("Processing done in %s with gross %v and correct %v",
		time.Since(t0).String(), ggrossamount, cggrossamount)
}

func workerProc(wi int, jobs <-chan *gdrj.SalesTrx, result chan<- string) {
	workerconn, _ := modules.GetDboxIConnection("db_godrej")
	defer workerconn.Close()
	defer mwg.Done()

	st := new(gdrj.SalesTrx)
	for st = range jobs {

		tablename := toolkit.Sprintf("%v-return", st.TableName())

		workerconn.NewQuery().From(tablename).
			Save().Exec(toolkit.M{}.Set("data", st))

		result <- st.ID
	}

}

func getcustomerclean(oid string) (cust *gdrj.Customer, cond bool) {
	cust = new(gdrj.Customer)
	cond = false

	if !custs.Has(oid) {
		cond = false

		cust.BranchID = "CD02"
		cust.CustType = "General"
		cust.IsRD = false
	} else {
		cond = true
		cust = custs[oid].(*gdrj.Customer)
	}

	//Do Cleaning
	subchannels := masters.Get("subchannels").(toolkit.M)
	subchannel := subchannels.GetString(cust.CustType)
	switch cust.ChannelID {
	case "I1":
		cust.IsRD = true
		cust.ChannelName = "RD"
		cust.ReportChannel = "RD"
		cust.ReportSubChannel = cust.Name
	case "I3": //MT
		subchannel = subchannels.GetString("M3")
		cust.ChannelName = "MT"
		cust.ReportChannel = "MT"

		if cust.CustType == "M1" || cust.CustType == "M2" {
			subchannel = subchannels.GetString(cust.CustType)
		}
		cust.ReportSubChannel = subchannel
	case "I4":
		cust.ChannelName = "INDUSTRIAL"
		cust.ReportChannel = "IT"
		// cust.ReportSubChannel = cust.Name
		cust.ReportSubChannel = subchannels.GetString("S8")
		if len(cust.CustType) == 2 && cust.CustType[:1] == "S" {
			cust.ReportSubChannel = subchannels.GetString(cust.CustType)
		}
	case "I6":
		cust.ChannelName = "MOTORIST"
		cust.ReportChannel = "Motoris"
		cust.ReportSubChannel = "Motoris"
	case "EXP":
		cust.ChannelName = "EXPORT"
		cust.ReportChannel = "EXPORT"
		cust.ReportSubChannel = "EXPORT"
	default:
		cust.ChannelID = "I2"
		cust.ChannelName = "GT"
		cust.ReportChannel = "GT"
		subchannel := subchannels.GetString(cust.CustType)

		if cust.CustType == "" || (len(cust.CustType) > 1 && cust.CustType[:1] != "R") {
			subchannel = ""
		}

		if subchannel == "" {
			cust.ReportSubChannel = "R18 - Lain-lain"
		} else {
			cust.ReportSubChannel = subchannel
		}
	}

	mbranchs := masters["branchs"].(toolkit.M)
	branch, isbranch := mbranchs[cust.BranchID].(toolkit.M)

	if isbranch {
		cust.BranchName = branch.GetString("name")
	}

	if !cond && isbranch {
		cust.National = branch.Get("national", "").(string)
		cust.Zone = branch.Get("zone", "").(string)
		cust.Region = branch.Get("region", "").(string)
		cust.AreaName = branch.Get("area", "").(string)
	} else if !cond {
		cust.National = "INDONESIA"
		cust.Zone = "OTHER"
		cust.Region = "OTHER"
		cust.AreaName = "OTHER"
	}

	if cust.IsRD && masters.Has("rdlocations") {
		mrdloc := masters["rdlocations"].(toolkit.M)
		if mrdloc.Has(cust.ID) {
			tkm := mrdloc[cust.ID].(toolkit.M)
			cust.Zone = tkm.GetString("zone")
			cust.Region = tkm.GetString("region")
			cust.AreaName = tkm.GetString("area")
		}
	}

	return
}
