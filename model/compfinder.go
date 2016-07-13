package gdrj

import (
	"github.com/eaciit/dbox"
	"github.com/eaciit/toolkit"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"sort"
	"strings"
	"time"
)

type CompFinderParam struct {
	PLs        []string  `json:"pls"`
	Breakdowns []string  `json:"groups"`
	Filters    []*Filter `json:"filters"`
	Aggr       string    `json:"aggr"`
	Flag       string    `json:"flag"`
	Tablename  string
}

func (s *CompFinderParam) GetCompCollection() ([]*toolkit.M, error) {
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
		if strings.HasPrefix(col, "comp_") {
			csr, err := DB().Connection.NewQuery().From(col).Take(1).Cursor(nil)
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

func (s *CompFinderParam) DeletePLCollection(table []string) error {
	db, session, err := s.ConnectToDB()
	if err != nil {
		return err
	}
	defer session.Close()

	for _, each := range table {
		err = db.C(each).DropCollection()
		if err != nil {
			return err
		}
	}

	return nil
}

func (s *CompFinderParam) parseFilter() *dbox.Filter {
	filters := []*dbox.Filter{}

	oldFilters := s.Filters
	for i, each := range oldFilters {
		if each.Field == "customer.channelname" {
			f := new(Filter)
			f.Field = "customer.channelid"
			f.Op = each.Op
			f.Value = each.Value

			s.Filters = append(oldFilters[:i], oldFilters[i+1:]...)
			s.Filters = append(s.Filters, f)

			break
		}
	}

	for _, each := range s.Filters {
		switch each.Op {
		case dbox.FilterOpIn:
			values := []string{}
			field := toolkit.Sprintf("_id.%s", strings.Replace(each.Field, ".", "_", -1))

			for _, v := range each.Value.([]interface{}) {
				values = append(values, v.(string))
			}

			if len(values) > 0 {
				subFilters := []*dbox.Filter{}
				for _, value := range values {
					subFilters = append(subFilters, dbox.Eq(field, value))
				}
				filters = append(filters, dbox.Or(subFilters...))
				toolkit.Printf("---- filter: %#v in %#v\n", field, values)
			}
		case dbox.FilterOpGte:
			var value interface{} = each.Value
			field := toolkit.Sprintf("_id.%s", strings.Replace(each.Field, ".", "_", -1))

			if value.(string) != "" {
				if field == "_id.date_year" {
					t, err := time.Parse(time.RFC3339Nano, value.(string))
					if err != nil {
						toolkit.Println(err.Error())
					} else {
						value = t.Year()
					}
				}

				filters = append(filters, dbox.Gte(field, value))
				toolkit.Printf("------GTE ---> %#v \n", dbox.Gte(field, value))
			}
		case dbox.FilterOpLte:
			var value interface{} = each.Value
			field := toolkit.Sprintf("_id.%s", strings.Replace(each.Field, ".", "_", -1))

			if value.(string) != "" {
				if field == "_id.date_year" {
					t, err := time.Parse(time.RFC3339Nano, value.(string))
					if err != nil {
						toolkit.Println(err.Error())
					} else {
						value = t.Year()
					}
				}

				filters = append(filters, dbox.Lte(field, value))
				toolkit.Printf("------LTE ---> %#v \n", dbox.Lte(field, value))
			}
		case dbox.FilterOpEqual:
			value := each.Value
			field := toolkit.Sprintf("_id.%s", strings.Replace(each.Field, ".", "_", -1))

			filters = append(filters, dbox.Eq(field, value))
			toolkit.Printf("------Equal ---> %#v \n", dbox.Eq(field, value))

		case dbox.FilterOpNoEqual:
			value := each.Value
			field := toolkit.Sprintf("_id.%s", strings.Replace(each.Field, ".", "_", -1))

			filters = append(filters, dbox.Ne(field, value))
			toolkit.Printf("------Not Equal ---> %#v \n", dbox.Ne(field, value))
		}
	}

	return dbox.And(filters...)
}

func (s *CompFinderParam) GetCompTableName() {
	cache := map[string]bool{}
	filterKeys := []string{}
	for _, filter := range s.Filters {
		if _, ok := cache[filter.Field]; !ok {
			cache[filter.Field] = true
			filterKeys = append(filterKeys, filter.Field)
		}
	}
	for _, breakdown := range s.Breakdowns {
		if _, ok := cache[breakdown]; !ok {
			cache[breakdown] = true
			filterKeys = append(filterKeys, breakdown)
		}
	}

	sort.Strings(filterKeys)
	filterList := strings.Replace(strings.Join(filterKeys, "_"), ".", "_", -69)

	cols, _ := s.GetCompCollection()
	for _, col := range cols {
		dimensions := col.Get("dimensions").([]string)
		sort.Strings(dimensions)
		dimensionList := strings.Join(dimensions, "_")

		ok := true

		toolkit.Println("############### DIMENSIONS\n", dimensionList)
		toolkit.Println("############### FILTER LIST\n", filterList)
		if dimensionList != filterList {
			ok = false
		}

		if ok {
			s.Tablename = col.GetString("table")
			break
		}
	}

	toolkit.Println("\n+++++++++++++++++++ CREATING A NEW COLLECTION +++++++++++++++")
	tableName := toolkit.Sprintf("comp_%s", filterList)
	s.Tablename = tableName
}

func (s *CompFinderParam) ConnectToDB() (*mgo.Database, *mgo.Session, error) {
	ci := DB().Connection.Info()
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

func (s *CompFinderParam) CountCompData() (bool, error) {
	csr, err := DB().Connection.NewQuery().From(s.Tablename).Take(2).Cursor(nil)
	if err != nil {
		return false, err
	}
	defer csr.Close()

	return (csr.Count() > 0), nil
}

func (s *CompFinderParam) GenerateCompData() error {
	tableName := s.Tablename

	db, sess, err := s.ConnectToDB()
	if err != nil {
		return err
	}
	defer sess.Close()

	col := db.C(new(SalesPL).TableName())

	cache := map[string]bool{}
	filterKeys := []string{}
	for _, filter := range s.Filters {
		if _, ok := cache[filter.Field]; !ok {
			cache[filter.Field] = true
			filterKeys = append(filterKeys, filter.Field)
		}
	}

	_id := bson.M{}
	for _, each := range append(s.Breakdowns, filterKeys...) {
		key := strings.Replace(each, ".", "_", -1)
		val := toolkit.Sprintf("$%s", each)
		_id[key] = val
	}

	group := bson.M{
		"_id":    _id,
		"qty":    bson.M{"$sum": "$salesqty"},
		"amount": bson.M{"$sum": "$pldatas.PL8A.amount"},
		"outlet": bson.M{"$sum": 1},
	}

	// group["outletlist"] = bson.M{"$addToSet": "$customer._id"}
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
