package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"encoding/json"
	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
	"io"
	"os"
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

func getCursor(obj orm.IModel) dbox.ICursor {
	c, e := gdrj.Find(obj, nil, nil)
	if e != nil {
		return nil
	}
	return c
}

func prepMaster() {
	pc := new(gdrj.SalesTrx)
	pcinvalid := []*gdrj.SalesTrx{}

	cpc := getCursor(pc)
	defer cpc.Close()
	var e error
	count := 0
	for e = cpc.Fetch(pc, 1, false); e == nil; {
		pcs.Set(pc.ID, pc)
		if pc.PCValid == false {
			count++
			pcinvalid = append(pcinvalid, pc)
		}
		if count > 50 {
			break
		}
		pc = new(gdrj.SalesTrx)
		e = cpc.Fetch(pc, 1, false)
	}
	createJson(pcinvalid, "pcinvalid.json")

	toolkit.Println("pc valid false count", count)
}

func createJson(data interface{}, filename string) {
	toolkit.Println("writing: " + filename)
	f, err := os.Create(filename)
	if err != nil {
		toolkit.Println(err)
	}

	jsonData, err := json.MarshalIndent(data, "", "   ")
	if err != nil {
		toolkit.Println(err)
	}
	jsonString := string(jsonData)

	n, err := io.WriteString(f, jsonString)
	if err != nil {
		toolkit.Println(n, err)
	}
	f.Close()
}

func main() {
	setinitialconnection()
	defer gdrj.CloseDb()

	toolkit.Println("Reading Master")
	prepMaster()

	toolkit.Println("END...")

}
