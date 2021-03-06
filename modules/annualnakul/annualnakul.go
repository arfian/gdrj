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
var ratioTableName string

var (
	sourcetablename = "salespls-summary"
	calctablename   = "salespls-summary"
	desttablename   = "salespls-summary"
	t0              time.Time
	masters         = toolkit.M{}
	sgaalloc        = map[string]float64{
		"EXP": 0.08,
		"I4":  0.08,
		"I6":  0.105,
	}
)

type plalloc struct {
	ID                     string `bson:"_id" json:"_id"`
	Key                    string
	Key1, Key2, Key3       string
	Ref1                   float64
	Current                float64
	Expect                 float64
	Absorbed               float64
	Ratio1, Ratio2, Ratio3 float64
}

type allocmap map[string]*plalloc

var (
	plallocs    = allocmap{}
	advtotals   = allocmap{}
	advyears    = allocmap{}
	spgtotals   = allocmap{}
	promototals = allocmap{}
	disctotals  = allocmap{}

	discyrkas  = allocmap{}
	spgyrkas   = allocmap{}
	promoyrkas = allocmap{}
	spgyrs     = allocmap{}
	promoyrs   = allocmap{}
	spgmths    = allocmap{}
	promomths  = allocmap{}
	discgts    = map[string]float64{
		"2014-2015": -60151910001,
		"2015-2016": -13960282833,
	}
	gtsales = allocmap{}
)

func main() {
	setinitialconnection()
	conn.NewQuery().From(desttablename).
		Where(dbox.Eq("key.trxsrc", "nakulrd")).
		Delete().
		Exec(nil)

	prepmastercalc()
	buildratio()
	processTable()
}

func buildratio() {
	connratio, _ := modules.GetDboxIConnection("db_godrej")
	defer connratio.Close()

	csp, _ := connratio.NewQuery().From("rawnakul").Select().Cursor(nil)
	defer csp.Close()
	i := 0
	count := csp.Count()
	t0 := time.Now()
	mstone := 0
	for {
		mr := toolkit.M{}
		if ef := csp.Fetch(&mr, 1, false); ef != nil {
			break
		}
		i++
		makeProgressLog("Disc, SPG & Promo by KA Ratio", i, count, 5, &mstone, t0)
		fiscal := mr.GetString("fiscal")
		kaid := mr.GetString("kaid")
		keyfiscalka := toolkit.Sprintf("%s_%s", fiscal, kaid)
		disc := -mr.GetFloat64("discount")
		spgv := -mr.GetFloat64("newspgv")
		promov := -mr.GetFloat64("newpromov")
		adjustAllocs(&discyrkas, keyfiscalka, 0, disc, 0, 0)
		adjustAllocs(&spgyrkas, keyfiscalka, 0, spgv, 0, 0)
		adjustAllocs(&promoyrkas, keyfiscalka, 0, promov, 0, 0)
	}

	ctrx, _ := connratio.NewQuery().From(calctablename).Select().Cursor(nil)
	i = 0
	count = ctrx.Count()
	t0 = time.Now()
	mstone = 0
	for {
		mr := toolkit.M{}
		if ef := ctrx.Fetch(&mr, 1, false); ef != nil {
			break
		}
		i++
		makeProgressLog("Update ratio sales", i, count, 5, &mstone, t0)

		key := mr.Get("key", toolkit.M{}).(toolkit.M)
		src := key.GetString("trxsrc")
		fiscal := key.GetString("date_fiscal")
		channelid := key.GetString("customer_channelid")
		kaid := key.GetString("customer_customergroup")
		brand := key.GetString("product_brand")
		if brand == "" {
			brand = "HIT"
		}

		if channelid == "I1" {
			continue
		}
		keyfiscalka := toolkit.Sprintf("%s_%s", fiscal, kaid)

		gross := mr.GetFloat64("PL0")
		sales := mr.GetFloat64("PL8A")

		//adjustAllocs(&discyrkas, keyfiscalka, 0, 0, 0, gross)
		adjustAllocs(&spgyrkas, keyfiscalka, 0, 0, 0, sales)
		adjustAllocs(&promoyrkas, keyfiscalka, 0, 0, 0, sales)

		discyrka := discyrkas[keyfiscalka]
		if discyrka != nil {
			adjustAllocs(&discyrkas, keyfiscalka, 0, 0, 0, gross)
		} else if discyrka == nil && channelid == "I2" && src == "VDIST" {
			adjustAllocs(&gtsales, fiscal, 0, 0, 0, gross)
		}
	}
}

func processTable() {
	connsave, _ := modules.GetDboxIConnection("db_godrej")
	defer connsave.Close()
	qsave := connsave.NewQuery().SetConfig("multiexec", true).From(desttablename).Save()

	connselect, _ := modules.GetDboxIConnection("db_godrej")
	defer connselect.Close()

	cursor, _ := connselect.NewQuery().
		From(calctablename).Select().Cursor(nil)
	defer cursor.Close()

	deletedids := []string{}

	i := 0
	count := cursor.Count()
	mstone := 0
	t0 = time.Now()
	for {
		mr := toolkit.M{}
		e := cursor.Fetch(&mr, 1, false)
		if e != nil || i >= count {
			break
		}
		i++
		makeProgressLog("Processing", i, count, 5, &mstone, t0)

		key := mr.Get("key", toolkit.M{}).(toolkit.M)
		fiscal := key.GetString("date_fiscal")
		channelid := key.GetString("customer_channelid")
		src := key.GetString("trxsrc")
		//period := key.GetInt("date_month")
		//brand := key.GetString("product_brand")
		keyaccountid := key.GetString("customer_customergroup")

		//keyperiod := toolkit.Sprintf("%s_%d", fiscal, period)
		keyfiscalka := toolkit.Sprintf("%s_%s", fiscal, keyaccountid)
		/*
			keyperiodaccount := toolkit.Sprintf("%s_%d_%s",
				fiscal, period, keyaccountid)
		*/
		//keyperiodbrand := toolkit.Sprintf("%s_%d_%s", fiscal, period, brand)

		gross := mr.GetFloat64("PL0")
		sales := mr.GetFloat64("PL8A")

		for _, k := range []string{"PL7A", "PL31C", "PL29A32"} {
			if isPL(k) {
				newv := float64(0)

				if channelid != "I1" {
					//--- discount
					if strings.HasPrefix(k, "PL7A") {
						disctotal := discyrkas[keyfiscalka]
						if disctotal != nil {
							newv = toolkit.Div(gross*disctotal.Expect,
								disctotal.Ref1)
							/*
								if gross > 0 && newv > 0 {
									toolkit.Printfn(
										"Disc k:%s g:%f t:%f tg:%f v:%f",
										keyfiscalka,
										gross, disctotal.Expect,
										disctotal.Ref1, newv)
								}
							*/
						} else if channelid == "I2" && src == "VDIST" {
							newv += toolkit.Div(gross*discgts[fiscal],
								gtsales[fiscal].Ref1)
							/*
								toolkit.Printfn("GT k:%s g:%f t:%f tg:%f v:%f",
									keyfiscalka,
									gross, discgts[fiscal],
									gtsales[fiscal].Ref1,
									newv)
							*/
						}
					} else
					//-- spg
					if k == "PL31C" {
						total := spgyrkas[keyfiscalka]
						if total != nil {
							newv = sales * total.Expect / total.Ref1
							//adjustAllocs(&spgyrkas, keyfiscalka, 0, 0, 0, newv)
						}
					} else
					//-- promo
					if k == "PL29A32" {
						total := promoyrkas[keyfiscalka]
						if total != nil {
							newv = sales * total.Expect / total.Ref1
							//adjustAllocs(&promoyrkas, keyfiscalka, 0, 0, 0, newv)
						}
					}
				}

				mr.Set(k, newv)
			}
		}

		gdrj.CalcSum(mr, masters)

		isDeleted := true
		for k, v := range mr {
			if strings.HasPrefix(k, "PL") && v != 0 {
				isDeleted = false
			}
		}

		mrid := mr.GetString("_id")
		if isDeleted {
			deletedids = append(deletedids, mrid)
		} else {
			esave := qsave.Exec(toolkit.M{}.Set("data", mr))
			if esave != nil {
				toolkit.Printfn("Error: %s", esave.Error())
				return
			}
		}
	}

	//-- scale
	/*
		cursor.ResetFetch()
		i = 0
		count = cursor.Count()
		mstone = 0
		t0 = time.Now()
		for {
			mr := toolkit.M{}
			e := cursor.Fetch(&mr, 1, false)
			if e != nil || i >= count {
				break
			}
			i++
			makeProgressLog("Scale", i, count, 5, &mstone, t0)

			id := mr.GetString("_id")
			key := mr.Get("key", toolkit.M{}).(toolkit.M)
			fiscal := key.GetString("date_fiscal")
			//ka := key.GetString("customer_customergroup")

			//keyfiscalka := toolkit.Sprintf("%s_%s", fiscal, ka)
			if !toolkit.HasMember(deletedids, id) {
				for k, v := range mr {
					if isPL(k) {
						newv := v.(float64)
						//ads
						if k == "PL28I" {
							total := advyears[fiscal]
							if total != nil {
								newv = toolkit.Div(v.(float64)*total.Expect,
									total.Ref1)
							}
						} /*else //-- spg
						if k == "PL31C" {
							total := spgyrkas[keyfiscalka]
							if total != nil {
								newv = toolkit.Div(v.(float64)*total.Expect,
									total.Ref1)
							}
						} else
						//-- promo
						if k == "PL29A32" {
							total := promoyrkas[keyfiscalka]
							if total != nil {
								newv = toolkit.Div(v.(float64)*total.Expect,
									total.Ref1)
							}
						}
	*/
	/*
						mr.Set(k, newv)
					}
				}

				gdrj.CalcSum(mr, masters)
				esave := qsave.Exec(toolkit.M{}.Set("data", mr))
				if esave != nil {
					toolkit.Printfn("Error: %s", esave.Error())
					return
				}
			}
		}
	*/

	toolkit.Printfn("Delete unneccessary data")
	for _, deletedid := range deletedids {
		connsave.NewQuery().From(desttablename).
			Where(dbox.Eq("_id", deletedid)).
			Delete().Exec(nil)
	}
}

func adjustAllocs(allocsmap *allocmap, key string, current, expect, absorbed, ref1 float64) {
	allocs := *allocsmap
	alloc := allocs[key]
	if alloc == nil {
		alloc = new(plalloc)
		alloc.Key = key
		alloc.ID = key
	}
	alloc.Current += current
	alloc.Expect += expect
	alloc.Ref1 += ref1
	alloc.Absorbed += absorbed
	allocs[key] = alloc
	*allocsmap = allocs
}

func makeProgressLog(reference string, i, count, step int, current *int, tstart time.Time) int {
	perstep := count * step / 100
	icurrent := *current
	if icurrent == 0 {
		icurrent = perstep
	}
	pct := i * 100 / count
	if i >= icurrent {
		toolkit.Printfn("%s, %d of %d [%d pct] in %s",
			reference, i, count, pct, time.Since(tstart).String())
		icurrent += perstep
	}
	*current = icurrent
	return icurrent
}

func isPL(id string) bool {
	if strings.HasPrefix(id, "PL7A") ||
		//strings.HasPrefix(id, "PL28") ||
		strings.HasPrefix(id, "PL29A") ||
		strings.HasPrefix(id, "PL31") {
		return true
	}
	return false
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
