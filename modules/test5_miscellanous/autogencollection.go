package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"eaciit/gdrj/web/model"
	"errors"
	"github.com/eaciit/dbox"
	"github.com/eaciit/toolkit"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type Filter struct {
	Field string      `json:"field"`
	Op    string      `json:"op"`
	Value interface{} `json:"value"`
}

var allCollections = []string{}
var conn dbox.IConnection
var wd, _ = os.Getwd()

/*var breakdownList = []string{"customer.branchname", "customer.channelid", "customer.channelname",
"customer.region", "customer.zone", "customer.areaname", "customer.keyaccount",
"customer.customergroup", "customer.name", "product.name",
"product.brand", "product.brandcategoryid", "customer.reportchannel", "customer.reportsubchannel"}*/

var pnlMutex sync.Mutex

type PLFinderParam struct {
	PLs        []string  `json:"pls"`
	Breakdowns []string  `json:"groups"`
	Filters    []*Filter `json:"filters"`
	Aggr       string    `json:"aggr"`
	Flag       string    `json:"flag"`
	Tablename  string
}

var breakdownList = map[int][]string{}

func main() {
	defer gdrj.CloseDb()
	/*n := len(breakdownList)

	for i := 1; i <= n; i++ {
		data := make([]string, i)
		combination(breakdownList, data, 0, n-1, 0, i)
	}
	for _, val := range allCollections {
		toolkit.Println(val)
		toolkit.Println()
	}
	toolkit.Println("total collections", len(allCollections))*/

	breakdownList[0] = []string{"date.fiscal", "customer.reportchannel", "customer.reportsubchannel", "customer.branchname"}
	breakdownList[1] = []string{"date.fiscal", "customer.channelid", "customer.channelname"}
	breakdownList[2] = []string{"date.fiscal", "customer.channelid", "customer.channelname", "customer.reportsubchannel"}
	breakdownList[3] = []string{"date.fiscal", "customer.channelid", "customer.channelname", "customer.zone"}
	breakdownList[4] = []string{"date.fiscal", "customer.channelid", "customer.channelname", "customer.areaname"}
	breakdownList[5] = []string{"date.fiscal", "customer.channelid", "customer.channelname", "customer.region"}
	breakdownList[6] = []string{"date.fiscal", "customer.branchname"}
	breakdownList[7] = []string{"date.fiscal", "product.brand"}
	breakdownList[8] = []string{"date.fiscal", "product.areaname"}
	breakdownList[9] = []string{"date.fiscal", "customer.keyaccount"}
	breakdownList[10] = []string{"date.fiscal", "date.month", "customer.channelid", "customer.channelname"}
	breakdownList[11] = []string{"date.fiscal", "date.month", "customer.branchname"}
	breakdownList[12] = []string{"date.fiscal", "date.month", "customer.areaname"}
	breakdownList[13] = []string{"date.fiscal", "date.month", "customer.keyaccount"}
	breakdownList[14] = []string{"date.fiscal", "date.quartertxt", "customer.channelid", "customer.channelname"}
	breakdownList[15] = []string{"date.fiscal", "date.quartertxt", "customer.branchname"}
	breakdownList[16] = []string{"date.fiscal", "date.quartertxt", "customer.brand"}
	breakdownList[17] = []string{"date.fiscal", "date.quartertxt", "customer.areaname"}
	breakdownList[18] = []string{"date.fiscal", "date.quartertxt", "customer.region"}
	breakdownList[19] = []string{"date.fiscal", "date.quartertxt", "customer.keyaccount"}
	breakdownList[20] = []string{"date.fiscal", "customer.reportchannel", "customer.reportsubchannel"}
	breakdownList[21] = []string{"date.fiscal", "customer.customergroupname"}
	breakdownList[22] = []string{"date.fiscal", "customer.channelid", "customer.channelname", "customer.branchname"}
	breakdownList[23] = []string{"date.fiscal", "customer.channelid", "customer.channelname", "customer.reportsubchannel"}
	breakdownList[24] = []string{"customer.branchname", "product.brand", "customer.channelname", "customer.areaname", "customer.region", "customer.zone", "customer.keyaccount"}

	gocore.ConfigPath = filepath.Join(wd, "config")

	setinitialconnection()

	res := new(toolkit.Result)
	res.Status = toolkit.Status_NOK

	// i := 0
	for _, val := range breakdownList {
		/*i++
		if i > 2 { //for testing purpose
			break
		}*/
		payload := new(PLFinderParam)
		payload.Breakdowns = append(payload.Breakdowns, val...)

	loopCreateCol:
		for {
			res = createCollection(payload).(*toolkit.Result)
			if res.Status == "OK" {
				break loopCreateCol
			}
			time.Sleep(1000 * time.Millisecond)
		}
	}
}

func combination(arr []string, data []string, start, end, index, r int) {
	if index == r {
		comb := "pl_date_fiscal_date_year"
		for j := 0; j < r; j++ {
			comb += "_" + data[j]
		}
		allCollections = append(allCollections, comb)
		return
	}

	for i := start; i <= end; i++ {
		if end-i+1 >= r-index {
			data[index] = arr[i]
			combination(arr, data, i+1, end, index+1, r)
		}
	}

}

func createCollection(payload *PLFinderParam) interface{} {
	res := new(toolkit.Result)

	// payload := new(PLFinderParam)
	toolkit.Println("counting")

	ok, err := payload.CountPLData()
	if err != nil {
		res.SetError(err)
		return res
	}

	toolkit.Println("counted", ok)

	tableName := payload.GetTableName()
	toolkit.Println("______ TABLENAME TABLENAME TABLENAME", tableName)

	if ok {
		// data, err := payload.GetPLData()
		// toolkit.Println("no error trying to get the data")

		// if err != nil {
		// 	res.SetError(err)
		// 	return res
		// }

		// plmodels, err := gdrj.PLModelGetAll()
		// if err != nil {
		// 	res.SetError(err)
		// 	return res
		// }

		// res.SetData(toolkit.M{
		// 	"Data":     data,
		// 	"PLModels": plmodels,
		// })
		res.Status = toolkit.Status_OK
		return res
	}

	if gocore.GetConfig(tableName) == "otw" {
		res.SetError(errors.New("still processing, might take a while"))
		toolkit.Println("on progress")
		return res
	}

	go func() {
		toolkit.Println("______", tableName, ok, gocore.GetConfig(tableName, ""))
		err = payload.GeneratePLData()
		if err != nil {
			toolkit.Println("done with error:", err.Error())
		} else {
			toolkit.Println("done")
		}

		pnlMutex.Lock()
		gocore.RemoveConfig(tableName)
		pnlMutex.Unlock()
	}()

	pnlMutex.Lock()
	gocore.SetConfig(tableName, "otw")
	pnlMutex.Unlock()

	res.SetError(errors.New("still processing, might take a while"))
	toolkit.Println("just start")

	return res
}

func (s *PLFinderParam) GetPLCollections() ([]*toolkit.M, error) {
	db, session, err := s.ConnectToDB()
	if err != nil {
		return nil, err
	}
	defer session.Close()

	cols, err := db.CollectionNames()
	if err != nil {
		return nil, err
	}

	res := []*toolkit.M{}

	for _, col := range cols {
		if strings.HasPrefix(col, "pl_") {
			csr, err := gdrj.DB().Connection.NewQuery().From(col).Take(1).Cursor(nil)
			if err != nil {
				return nil, err
			}
			defer csr.Close()

			colRes := []*toolkit.M{}
			err = csr.Fetch(&colRes, 0, false)
			if err != nil {
				return nil, err
			}

			if len(colRes) > 0 {
				dimensions := []string{}
				for key := range colRes[0].Get("_id").(toolkit.M) {
					dimensions = append(dimensions, key)
				}

				row := toolkit.M{}
				row.Set("table", col)
				row.Set("dimensions", dimensions)
				res = append(res, &row)
			}
		}
	}

	return res, nil
}

func (s *PLFinderParam) GetTableName() string {
	cache := map[string]bool{}
	filterKeys := []string{}

	for _, breakdown := range s.Breakdowns {
		if _, ok := cache[breakdown]; !ok {
			cache[breakdown] = true
			filterKeys = append(filterKeys, breakdown)
		}
	}

	/*cols, _ := s.GetPLCollections()
	for _, col := range cols {
		dimensions := col.Get("dimensions").([]string)
		ok := true

	loopFilter:
		for _, filterKey := range filterKeys {
			filter := strings.Replace(filterKey, ".", "_", -1)
			if !toolkit.HasMember(dimensions, filter) {
				ok = false
				break loopFilter
			}
		}

		if ok {
			return col.GetString("table")
		}
	}*/

	sort.Strings(filterKeys)
	key := strings.Replace(strings.Join(filterKeys, "_"), ".", "_", -1)
	tableName := toolkit.Sprintf("pl_%s", key)

	return tableName
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

func (s *PLFinderParam) ConnectToDB() (*mgo.Database, *mgo.Session, error) {
	ci := gdrj.DB().Connection.Info()
	mgoi := &mgo.DialInfo{
		Addrs:    []string{ci.Host},
		Timeout:  10 * time.Minute,
		Username: ci.UserName,
		Password: ci.Password,
	}

	session, err := mgo.DialWithInfo(mgoi)
	if err != nil {
		return nil, session, err
	}

	session.SetMode(mgo.Monotonic, true)
	db := session.DB(ci.Database)

	return db, session, nil
}

func (s *PLFinderParam) CountPLData() (bool, error) {
	_, _, err := s.ConnectToDB()

	tableName := s.GetTableName()

	csr, err := gdrj.DB().Connection.NewQuery().From(tableName).Take(2).Cursor(nil)
	if err != nil {
		return false, err
	}
	defer csr.Close()

	return (csr.Count() > 0), nil
}

func (s *PLFinderParam) GeneratePLData() error {
	tableName := s.GetTableName()

	plmodels, err := gdrj.PLModelGetAll()
	if err != nil {
		return err
	}

	db, sess, err := s.ConnectToDB()
	if err != nil {
		return err
	}
	defer sess.Close()

	col := db.C(new(gdrj.SalesPL).TableName())

	_id := bson.M{}
	for _, each := range s.Breakdowns {
		key := strings.Replace(each, ".", "_", -1)
		val := toolkit.Sprintf("$%s", each)
		_id[key] = val
	}

	group := bson.M{
		"_id":                _id,
		"salesqty":           bson.M{"$sum": "$salesqty"},
		"grossamount":        bson.M{"$sum": "$grossamount"},
		"discountamount":     bson.M{"$sum": "$discountamount"},
		"taxamount":          bson.M{"$sum": "$taxamount"},
		"netamount":          bson.M{"$sum": "$netamount"},
		"count":              bson.M{"$sum": 1},
		"ratiotoglobalsales": bson.M{"$sum": "$ratiotoglobalsales"},
		"ratiotobranchsales": bson.M{"$sum": "$ratiotobranchsales"},
		"ratiotobrandsales":  bson.M{"$sum": "$ratiotobrandsales"},
		"ratiotoskusales":    bson.M{"$sum": "$ratiotoskusales"},
	}

	for _, plmod := range plmodels {
		key := strings.Replace(plmod.ID, ".", "_", -1)
		field := toolkit.Sprintf("$pldatas.%s.amount", plmod.ID)
		group[key] = bson.M{"$sum": field}
	}

	group["outlets"] = bson.M{"$addToSet": "$customer._id"}
	project := bson.M{"totaloutlet": bson.M{"$size": "$outlets"}}
	for key := range group {
		if key == "_id" {
			continue
		}

		project[key] = 1
	}

	pipes := []bson.M{{"$group": group}, {"$project": project}, {"$out": tableName}}
	pipe := col.Pipe(pipes)

	res := []*toolkit.M{}
	err = pipe.AllowDiskUse().All(&res)
	if err != nil {
		return err
	}

	_ = res
	return nil
}
