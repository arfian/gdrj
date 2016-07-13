package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"errors"
	"github.com/eaciit/dbox"
	"github.com/eaciit/toolkit"
	"os"
	"strings"
	"time"
)

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
	pcs = toolkit.M{}
)

func getData(tablename string) (toolkit.Ms, error) {
	cons, err := modules.GetDboxIConnection("db_godrej")
	if err != nil {
		return nil, err
	}
	// q := cons.NewQuery().From(tablename)
	var q dbox.IQuery
	if tablename == "gross" {
		q = cons.NewQuery().From("salestrxs").
			Group("month", "year", "customer.branchid", "customer.channelid").
			Aggr(dbox.AggrSum, "$grossamount", "grossamount").
			Where(dbox.And(dbox.Gte("date", time.Date(2014, 4, 1, 0, 0, 0, 0, time.UTC)),
			dbox.Lte("date", time.Date(2015, 3, 31, 0, 0, 0, 0, time.UTC)),
			dbox.Gt("grossamount", 0)))
	} else if tablename == "discount" {
		q = cons.NewQuery().From("salestrxs").
			Group("month", "year", "customer.branchid", "customer.channelid").
			Aggr(dbox.AggrSum, "$discountamount", "discountamount").
			Where(dbox.And(dbox.Gte("date", time.Date(2014, 4, 1, 0, 0, 0, 0, time.UTC)),
			dbox.Lte("date", time.Date(2015, 3, 31, 0, 0, 0, 0, time.UTC)),
			dbox.Gt("discountamount", 0)))
	} else if tablename == "return" {
		q = cons.NewQuery().From("salestrxs").
			Group("month", "year", "customer.branchid", "customer.channelid").
			Aggr(dbox.AggrSum, "$grossamount", "returnamount").
			Where(dbox.And(dbox.Gte("date", time.Date(2014, 4, 1, 0, 0, 0, 0, time.UTC)),
			dbox.Lte("date", time.Date(2015, 3, 31, 0, 0, 0, 0, time.UTC)),
			dbox.Lt("grossamount", 0)))
	} else {
		q = cons.NewQuery().From("salestrxs").
			Group("month", "year", "customer.branchid", "customer.channelid").
			Aggr(dbox.AggrSum, "$discountamount", "returndiscount").
			Where(dbox.And(dbox.Gte("date", time.Date(2014, 4, 1, 0, 0, 0, 0, time.UTC)),
			dbox.Lte("date", time.Date(2015, 3, 31, 0, 0, 0, 0, time.UTC)),
			dbox.Lt("discountamount", 0)))
	}

	c, e := q.Cursor(nil)
	if e != nil {
		return nil, errors.New("Preparing cursor error " + e.Error())
	}
	defer c.Close()

	data := toolkit.Ms{}
	toolkit.Println("preparing to fetch")
	t0 := time.Now()
	e = c.Fetch(&data, 0, false)
	if e != nil {
		return nil, errors.New("Fetch cursor error " + e.Error())
	}
	toolkit.Printfn("Fetching %d data in %s", toolkit.SliceLen(data), time.Since(t0).String())

	return data, nil
}

func mappingValue(data toolkit.Ms, tipe string) toolkit.M {
	value := toolkit.M{}
	var totalValue float64
	var cleanValue float64

	for _, k := range data {
		_data, _ := toolkit.ToM(k["_id"])

		id := ""
		if _data.GetInt("month") < 10 {
			id = _data.GetString("customer_branchid") + "_" + _data.GetString("customer_channelid") + "_" +
				toolkit.ToString(_data.GetInt("year")) + "_" + "0" + toolkit.ToString(_data.GetInt("month"))
		} else {
			id = _data.GetString("customer_branchid") + "_" + _data.GetString("customer_channelid") + "_" +
				toolkit.ToString(_data.GetInt("year")) + "_" + toolkit.ToString(_data.GetInt("month"))
		}
		if tipe == "gross" {
			totalValue += k.GetFloat64("grossamount")
			channel := _data.GetString("customer_channelid")
			if channel != "DISCOUNT" && channel != "EXP" && channel != "I1" {
				cleanValue += k.GetFloat64("grossamount")
			}
			value.Set(id, k.GetFloat64("grossamount"))
		} else if tipe == "discount" {
			totalValue += k.GetFloat64("discountamount")
			channel := _data.GetString("customer_channelid")
			if channel != "DISCOUNT" && channel != "EXP" && channel != "I1" {
				cleanValue += k.GetFloat64("discountamount")
			}
			value.Set(id, k.GetFloat64("discountamount"))
		} else if tipe == "return" {
			value.Set(id, k.GetFloat64("returnamount"))
		} else {
			value.Set(id, k.GetFloat64("returndiscount"))
		}
	}
	toolkit.Println("total value", tipe, totalValue)
	toolkit.Println("total clean value", tipe, cleanValue)

	return value
}

func main() {
	setinitialconnection()
	defer gdrj.CloseDb()

	grossdata, err := getData("gross")
	if err != nil {
		toolkit.Println("error", err)
	}

	discountdata, err := getData("discount")
	if err != nil {
		toolkit.Println("error", err)
	}

	returndata, err := getData("return")
	if err != nil {
		toolkit.Println("error", err)
	}

	returndiscdata, err := getData("kangen bojoooo")
	if err != nil {
		toolkit.Println("error", err)
	}

	grossamt := mappingValue(grossdata, "gross")
	discamt := mappingValue(discountdata, "discount")
	returnamt := mappingValue(returndata, "returnamount")
	returndisc := mappingValue(returndiscdata, "kemrungsung")

	branches := toolkit.M{}
	branch := new(gdrj.Branch)
	cbranch, err := gdrj.Find(branch, nil, nil)
	if err != nil {
		toolkit.Println("error", err.Error())
	}
	defer cbranch.Close()
	for err = cbranch.Fetch(branch, 1, false); err == nil; {
		branches.Set(branch.ID, branch.Name)
		branch = new(gdrj.Branch)
		err = cbranch.Fetch(branch, 1, false)
	}

	channels := toolkit.M{}
	channel := new(gdrj.Channel)
	cchannel, err := gdrj.Find(channel, nil, nil)
	if err != nil {
		toolkit.Println("error", err.Error())
	}
	defer cchannel.Close()
	for err = cchannel.Fetch(channel, 1, false); err == nil; {
		channels.Set(channel.ID, channel.Name)
		channel = new(gdrj.Channel)
		err = cchannel.Fetch(channel, 1, false)
	}

	keyList := []string{}

	keyList = checkData(grossamt, branches, channels, grossamt, discamt, returnamt, returndisc, keyList)
	keyList = checkData(discamt, branches, channels, grossamt, discamt, returnamt, returndisc, keyList)
	keyList = checkData(returnamt, branches, channels, grossamt, discamt, returnamt, returndisc, keyList)
	keyList = checkData(returndisc, branches, channels, grossamt, discamt, returnamt, returndisc, keyList)
}

func checkData(data, branches, channels, grossamt, discamt, returnamt, returndisc toolkit.M, keyList []string) []string {
	for key := range data {
		if !toolkit.HasMember(keyList, key) {
			keyList = append(keyList, key)
			report := new(gdrj.CsvReport)
			report.ID = toolkit.RandomString(32)
			split := strings.Split(key, "_")
			report.BranchID = split[0]
			report.Branch = toolkit.ToString(branches[split[0]])
			report.ChannelID = split[1]
			report.Channel = toolkit.ToString(channels[split[1]])
			report.Date = split[3] + " " + split[2]

			if grossamt.Has(key) && discamt.Has(key) {
				report.GrossAmount = grossamt.GetFloat64(key)
				report.DiscountAmount = discamt.GetFloat64(key)
				report.InvoiceAmount = grossamt.GetFloat64(key) + discamt.GetFloat64(key)
			} else if grossamt.Has(key) {
				report.GrossAmount = grossamt.GetFloat64(key)
				report.DiscountAmount = 0
				report.InvoiceAmount = grossamt.GetFloat64(key)
			} else if discamt.Has(key) {
				report.GrossAmount = 0
				report.DiscountAmount = discamt.GetFloat64(key)
				report.InvoiceAmount = discamt.GetFloat64(key)
			} else {
				report.GrossAmount = 0
				report.DiscountAmount = 0
				report.InvoiceAmount = 0
			}

			if returnamt.Has(key) && returndisc.Has(key) {
				report.ReturnAmount = returnamt.GetFloat64(key)
				report.ReturnDiscount = returndisc.GetFloat64(key)
				report.ReturnInvoiceAmount = returnamt.GetFloat64(key) + returndisc.GetFloat64(key)
			} else if returnamt.Has(key) {
				report.ReturnAmount = returnamt.GetFloat64(key)
				report.ReturnDiscount = 0
				report.ReturnInvoiceAmount = returnamt.GetFloat64(key)
			} else if returndisc.Has(key) {
				report.ReturnAmount = 0
				report.ReturnDiscount = returndisc.GetFloat64(key)
				report.ReturnInvoiceAmount = returndisc.GetFloat64(key)
			} else {
				report.ReturnAmount = 0
				report.ReturnDiscount = 0
				report.ReturnInvoiceAmount = 0
			}
			report.Save()
		}
	}

	return keyList
}
