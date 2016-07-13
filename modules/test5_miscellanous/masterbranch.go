package main

import (
	"eaciit/gdrj/model"
	"eaciit/gdrj/modules"
	"errors"
	"github.com/eaciit/dbox"
	"github.com/eaciit/toolkit"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"os"
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

func getData() (toolkit.Ms, error) {
	cons, err := modules.GetDboxIConnection("db_godrej")
	if err != nil {
		return nil, err
	}
	q := cons.NewQuery().From("costcenter").
		Group("branchid").
		Where(dbox.Nin("branchid", "CD06", "CD14", "CD12", "CD15", "CD02", "CD11", "CD04", "CD05", "CD08", "CD10", "CD13", "CD09", "CD07"))

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

func mappingValue(data toolkit.Ms) []string {
	value := []string{}

	for _, k := range data {
		_data, _ := toolkit.ToM(k["_id"])
		value = append(value, _data.GetString("branchid"))
	}

	return value
}

func main() {
	setinitialconnection()
	defer gdrj.CloseDb()

	// data, err := getData()
	// if err != nil {
	// 	toolkit.Println("error", err)
	// }

	// mappedData := mappingValue(data)
	// costcenter := new(gdrj.CostCenter)

	// ccostcenter, err := gdrj.Find(costcenter, nil, nil)
	// if err != nil {
	// 	toolkit.Println("error", err.Error())
	// }
	// defer ccostcenter.Close()
	// branchlist := []string{}
	// for err = ccostcenter.Fetch(costcenter, 1, false); err == nil; {
	// 	if toolkit.HasMember(mappedData, costcenter.BranchID) && !toolkit.HasMember(branchlist, costcenter.BranchID) {
	// 		branchlist = append(branchlist, costcenter.BranchID)
	// 		branch := new(gdrj.Branch)
	// 		branch.ID = costcenter.BranchID
	// 		branch.Name = costcenter.Name
	// 		// toolkit.Println(branch.ID, branch.Name)
	// 		// branch.Save()
	// 	}
	// 	costcenter = new(gdrj.CostCenter)
	// 	err = ccostcenter.Fetch(costcenter, 1, false)
	// }
	truckcount()
}

func connectToDB() (*mgo.Database, *mgo.Session, error) {
	ci := gdrj.DB().Connection.Info()
	mgoi := &mgo.DialInfo{
		Addrs:   []string{ci.Host},
		Timeout: 10 * time.Minute,
		// Database: ci.Database,
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

func truckcount() error {
	tableName := "totaltruck"

	db, sess, err := connectToDB()
	if err != nil {
		return err
	}
	defer sess.Close()

	col := db.C(new(gdrj.TruckAssignment).TableName())

	// cache := map[string]bool{}
	// filterKeys := []string{}
	/*for _, filter := range s.Filters {
		if _, ok := cache[filter.Field]; !ok {
			cache[filter.Field] = true
			filterKeys = append(filterKeys, filter.Field)
		}
	}*/

	_id := bson.M{
		"branch": "$branchid",
		"month":  bson.M{"$substr": `['$date', 5, 2]`},
		"year":   bson.M{"$substr": `['$date', 0, 4]`},
	}

	//{$group : {_id : {branch : "$branchid", month : {$substr: ['$date', 5, 2]},
	//year : {$substr: ['$date', 0, 4]}}, truck : {$sum : 1}}}
	/*for _, each := range append(s.Breakdowns, filterKeys...) {
		key := strings.Replace(each, ".", "_", -1)
		val := toolkit.Sprintf("$%s", each)
		_id[key] = val
	}*/

	group := bson.M{
		"_id":   _id,
		"truck": bson.M{"$sum": 1},
	}

	project := bson.M{}

	for key := range group {
		if key == "_id" {
			continue
		}

		project[key] = 1
	}

	pipes := []bson.M{{"$group": group}, {"$project": project}, {"$out": tableName}}
	pipe := col.Pipe(pipes)

	res := []*toolkit.M{}
	pipe.AllowDiskUse()
	err = pipe.All(&res)
	if err != nil {
		return err
	}

	_ = res

	return nil
}
