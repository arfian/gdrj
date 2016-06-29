package gdrj

import (
	"fmt"
	"github.com/eaciit/dbox"
	"github.com/eaciit/knot/knot.v1"
	"github.com/eaciit/toolkit"
	"gopkg.in/mgo.v2"
	"gopkg.in/mgo.v2/bson"
	"math"
	"sort"
	"strings"
	"time"
)

type Filter struct {
	Field string      `json:"field"`
	Op    string      `json:"op"`
	Value interface{} `json:"value"`
}

type PLFinderParam struct {
	PLs        []string  `json:"pls"`
	Breakdowns []string  `json:"groups"`
	Filters    []*Filter `json:"filters"`
	Aggr       string    `json:"aggr"`
	Flag       string    `json:"flag"`
	TableKey   string    `json:"tablekey"`
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

func (s *PLFinderParam) DeletePLCollection(table []string) error {
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

func (s *PLFinderParam) GetPayload(r *knot.WebContext) error {
	err := r.GetPayload(s)
	if err != nil {
		return err
	}

	for i, breakdown := range s.Breakdowns {
		if breakdown == "customer.channelname" {
			s.Breakdowns[i] = "customer.channelid"
		}
	}

	for _, filter := range s.Filters {
		if filter.Field == "customer.channelname" {
			filter.Field = "customer.channelid"
		}
	}

	return nil
}

func (s *PLFinderParam) ParseFilter() *dbox.Filter {
	filters := []*dbox.Filter{}

	oldFilters := s.Filters
	for _, each := range oldFilters {
		if each.Field == "customer.channelid" {

			for _, sub := range each.Value.([]interface{}) {

				// if the user select I3-MT, then the value should be MT + DISCOUNT
				if sub.(string) == "I3" {
					each.Value = append(each.Value.([]interface{}), "DISCOUNT")
					fmt.Println("HAS I3-MT", each.Value)
					break
				}

				// if the user select I2-GT, then the value should be GT + ""
				if sub.(string) == "I2" {
					each.Value = append(each.Value.([]interface{}), "")
					fmt.Println("HAS I2-GT", each.Value)
					break
				}
			}

			break
		}
	}

	for _, each := range s.Filters {
		switch each.Op {
		case dbox.FilterOpIn:
			values := []string{}
			field := fmt.Sprintf("%s.%s", s.TableKey, strings.Replace(each.Field, ".", "_", -1))
			hasOther := false

			for _, v := range each.Value.([]interface{}) {
				if strings.ToLower(v.(string)) == "other" {
					if !hasOther {
						hasOther = true
					}

					continue
				}

				values = append(values, v.(string))
			}

			if len(values) > 0 || hasOther {
				valuesInt := []interface{}{}
				valuesIntSpace := []interface{}{}
				for _, each := range values {
					valuesInt = append(valuesInt, each)
					valuesIntSpace = append(valuesIntSpace, fmt.Sprintf("%s ", each))
				}

				subFilter := []*dbox.Filter{
					dbox.In(field, valuesInt...),
				}

				if field == "_id.customer_branchname" {
					subFilter = append(subFilter, dbox.In(field, valuesIntSpace...))
				}

				if hasOther {
					subFilter = append(subFilter, dbox.Or(
						dbox.Eq(field, nil),
						dbox.Eq(field, ""),
						dbox.Contains(field, "other"),
					))

					fmt.Printf("---- filter: %#v in %#v\n", field, valuesIntSpace)
				}

				filters = append(filters, dbox.Or(subFilter...))
				fmt.Printf("---- filter: %#v in %#v\n", field, valuesInt)
			}
		case dbox.FilterOpGte:
			var value interface{} = each.Value
			field := fmt.Sprintf("%s.%s", s.TableKey, strings.Replace(each.Field, ".", "_", -1))

			// interface is []interface {}, not string
			if value.(string) != "" {
				if field == "_id.date_year" {
					t, err := time.Parse(time.RFC3339Nano, value.(string))
					if err != nil {
						fmt.Println(err.Error())
					} else {
						value = t.Year()
					}
				}

				filters = append(filters, dbox.Gte(field, value))
				fmt.Printf("---- filter: |%#v| |_id.date_year| gte %#v\n", field, value)
			}
		case dbox.FilterOpLte:
			var value interface{} = each.Value
			field := fmt.Sprintf("%s.%s", s.TableKey, strings.Replace(each.Field, ".", "_", -1))

			if value.(string) != "" {
				if field == "_id.date_year" {
					t, err := time.Parse(time.RFC3339Nano, value.(string))
					if err != nil {
						fmt.Println(err.Error())
					} else {
						value = t.Year()
					}
				}

				filters = append(filters, dbox.Lte(field, value))
				fmt.Printf("---- filter: %#v lte %#v\n", field, value)
			}
		case dbox.FilterOpEqual:
			value := each.Value
			field := fmt.Sprintf("%s.%s", s.TableKey, strings.Replace(each.Field, ".", "_", -1))

			filters = append(filters, dbox.Eq(field, value))
			fmt.Println("---- filter: ", field, "eq", value)
		}
	}

	// fb := dbox.NewFilterBuilder(nil)
	// fb.AddFilter(dbox.And(filters...))
	// a, _ := fb.Build()
	// fmt.Printf("-----OTHEHERHER---------- %#v\n", a)

	return dbox.And(filters...)
}

func (s *PLFinderParam) GetTableName() string {
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

	// cols, _ := s.GetPLCollections()
	// for _, col := range cols {
	// 	dimensions := col.Get("dimensions").([]string)
	// 	ok := true

	// loopFilter:
	// 	for _, filterKey := range filterKeys {
	// 		filter := strings.Replace(filterKey, ".", "_", -1)
	// 		if !toolkit.HasMember(dimensions, filter) {
	// 			ok = false
	// 			break loopFilter
	// 		}
	// 	}

	// 	if ok {
	// 		return col.GetString("table")
	// 	}
	// }

	sort.Strings(filterKeys)
	key := strings.Replace(strings.Join(filterKeys, "_"), ".", "_", -1)
	tableName := fmt.Sprintf("pl_%s", key)

	s.TableKey = "_id"
	if tableName == "pl_customer_channelid_date_fiscal" {
		s.TableKey = "key"
	}

	return tableName
}

func (s *PLFinderParam) ConnectToDB() (*mgo.Database, *mgo.Session, error) {
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

func (s *PLFinderParam) CountPLData() (bool, error) {
	tableName := s.GetTableName()

	csr, err := DB().Connection.NewQuery().From(tableName).Take(2).Cursor(nil)
	if err != nil {
		return false, err
	}
	defer csr.Close()

	return (csr.Count() > 0), nil
}

func (s *PLFinderParam) GetPLModelsFollowPLS() ([]*PLModel, error) {
	res := []*PLModel{}

	q := DB().Connection.NewQuery().From(new(PLModel).TableName())
	defer q.Close()

	if len(s.PLs) > 0 {
		filters := []*dbox.Filter{}
		for _, pl := range s.PLs {
			filters = append(filters, dbox.Eq("_id", pl))
		}
		q = q.Where(dbox.Or(filters...))
	}

	csr, err := q.Cursor(nil)
	if err != nil {
		return nil, err
	}
	defer csr.Close()

	err = csr.Fetch(&res, 0, false)
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (s *PLFinderParam) noZero(num float64) float64 {
	if math.IsNaN(num) || math.IsInf(num, 1) || math.IsInf(num, -1) {
		return 0
	}

	return num
}

func (s *PLFinderParam) Sum(raw *toolkit.M, i ...string) float64 {
	total := 0.0
	for _, j := range i {
		total = total + s.noZero(raw.GetFloat64(j))
	}
	return total
}

func (s *PLFinderParam) CalculatePL(data *[]*toolkit.M) *[]*toolkit.M {
	channelid := "_id_customer_channelid"
	channelname := "_id_customer_channelname"
	res := []*toolkit.M{}

	// hasChannel := false
	otherData := map[int]*toolkit.M{}

	for i, each := range *data {
		_id := each.Get("_id").(toolkit.M)

		for _, brkdwn := range s.Breakdowns {
			key := fmt.Sprintf("_id_%s", strings.Replace(brkdwn, ".", "_", -1))
			if !_id.Has(key) {
				_id.Set(key, "Other")
			}
		}

		// fmt.Printf("------------ %#v\n", _id)

		for key, val := range _id {
			if val == nil {
				_id.Set(key, "Other")
			} else if fmt.Sprintf("%v", val) == "" {
				_id.Set(key, "Other")
			}

			if _, ok := otherData[i]; strings.ToLower(fmt.Sprintf("%v", _id[key])) == "other" && !ok {
				otherData[i] = each
			}
		}

		if _id.Has(channelid) {
			// hasChannel = true
			channelid := strings.ToUpper(fmt.Sprintf("%v", _id[channelid]))

			switch channelid {
			case "I6":
				_id.Set(channelname, "Motorist")
			case "I4":
				_id.Set(channelname, "Industrial")
			case "I1":
				_id.Set(channelname, "Regional Distributor")
			case "I3":
				_id.Set(channelname, "Modern Trade")
			case "I2":
				_id.Set(channelname, "General Trade")
			case "EXP":
				_id.Set(channelname, "Export")
				// case "DISCOUNT":
				// 	_id.Set(channelname, "DISCOUNT")
				// case "":
				// 	_id.Set(channelname, "")
			}
		}
	}

	fmt.Println("========= OTHER DATA BLEND INTO ONE OTHER")
	fmt.Printf("%#v\n", otherData)
	if len(otherData) > 1 {
		sumOther := toolkit.M{}
		for _, each := range otherData {
			sumOther.Set("_id", each.Get("_id"))

			for key := range *each {
				if key == "_id" {
					continue
				}

				if _, ok := sumOther[key]; !ok {
					sumOther.Set(key, each.GetFloat64(key))
				} else {
					sumOther.Set(key, each.GetFloat64(key)+sumOther.GetFloat64(key))
				}
			}
		}

		newData := []*toolkit.M{&sumOther}
		for i, each := range *data {
			if _, ok := otherData[i]; ok {
				continue
			}

			newData = append(newData, each)
		}
		data = &newData
	}

	/** NOT USED NOW, THE DAtA IS VALLID
	// if breakdown channel
	if hasChannel {
		channelDiscountIndex := -1
		channelDiscount := new(toolkit.M)

		channelMTIndex := -1
		channelMT := new(toolkit.M)

		channelEmptyIndex := -1
		channelEmpty := new(toolkit.M)

		channelGTIndex := -1
		channelGT := new(toolkit.M)

		for i, each := range *data {
			_id := each.Get("_id").(toolkit.M)
			channelid := strings.ToUpper(_id.GetString(channelid))

			switch channelid {
			case "DISCOUNT":
				channelDiscountIndex = i
				channelDiscount = each
			case "I3":
				channelMTIndex = i
				channelMT = each
			case "I2":
				channelGTIndex = i
				channelGT = each
			case "":
				channelEmptyIndex = i
				channelEmpty = each
			}
		}

		// if there is I3-MT and Discount, then summarize it
		if (channelMTIndex > -1) && (channelDiscountIndex > -1) {
			fmt.Println("calculate the MT + DISCOUNT")
			for key := range *channelDiscount {
				if key == "_id" {
					continue
				}

				total := channelMT.GetFloat64(key) + channelDiscount.GetFloat64(key)
				channelMT.Set(key, total)
			}

			newData := []*toolkit.M{}
			for i, each := range *data {
				if i == channelDiscountIndex {
					continue
				}
				newData = append(newData, each)
			}

			realData := *data
			realData = append(realData[:channelDiscountIndex], realData[channelDiscountIndex+1:]...)
			data = &realData
		}

		// if there is I2-GT and "", then summarize it
		if (channelGTIndex > -1) && (channelEmptyIndex > -1) {
			fmt.Println("calculate the GT + ")
			for key := range *channelEmpty {
				if key == "_id" {
					continue
				}

				total := channelGT.GetFloat64(key) + channelEmpty.GetFloat64(key)
				channelGT.Set(key, total)
			}

			newData := []*toolkit.M{}
			for i, each := range *data {
				if i == channelEmptyIndex {
					continue
				}
				newData = append(newData, each)
			}

			realData := *data
			realData = append(realData[:channelEmptyIndex], realData[channelEmptyIndex+1:]...)
			data = &realData
		}
	}*/

	if s.Flag != "" {
		for _, raw := range *data {
			grossSales := s.Sum(raw, "grossamount")
			salesDiscount := s.Sum(raw, "discountamount")
			btl := s.Sum(raw, "PL29", "PL30", "PL31", "PL32")
			qty := s.Sum(raw, "salesqty")
			netSales := s.Sum(raw, "PL8A")
			netAmount := s.Sum(raw, "netamount")
			salesReturn := s.Sum(raw, "PL3")
			freightExpense := s.Sum(raw, "PL23")
			directLabour := s.Sum(raw, "PL14")
			directExpenses := s.Sum(raw, "PL14A")
			indirectExpense := s.Sum(raw, "PL74A")
			cogs := s.Sum(raw, "PL74B")
			materialLocal := s.Sum(raw, "PL9")
			materialImport := s.Sum(raw, "PL10")
			materialOther := s.Sum(raw, "PL13")
			sga := s.Sum(raw, "PL94A")
			netprice := math.Abs(s.noZero(netAmount / qty))
			netpricebtl := math.Abs(netprice + btl)
			countOutlet := s.Sum(raw, "totaloutlet")
			indirectPersonnel := s.Sum(raw, "PL15")
			indirectServices := s.Sum(raw, "PL16")
			indirectRent := s.Sum(raw, "PL17")
			indirectTransportation := s.Sum(raw, "PL18")
			indirectMaintenance := s.Sum(raw, "PL19")
			indirectOther := s.Sum(raw, "PL20")
			indirectAmort := s.Sum(raw, "PL21")
			indirectEnergy := s.Sum(raw, "PL74")
			advertising := s.Sum(raw, "PL28")
			bonus := s.Sum(raw, "PL29")
			gondola := s.Sum(raw, "PL30")
			otheradvertising := s.Sum(raw, "PL31")
			personnelga := s.Sum(raw, "PL33")
			generalga := s.Sum(raw, "PL34")
			deprga := s.Sum(raw, "PL35")
			foreignga := s.Sum(raw, "PL94")

			each := toolkit.M{}
			if s.Flag == "gross_sales_discount_and_net_sales" {
				each.Set("gross_sales", grossSales)
				each.Set("sales_discount", math.Abs(salesDiscount))
				each.Set("net_sales", netSales)
			} else if s.Flag == "gross_sales_qty" {
				each.Set("gross_sales", grossSales)
				each.Set("qty", qty)
				each.Set("gross_sales_qty", s.noZero(grossSales/qty))
			} else if s.Flag == "discount_qty" {
				each.Set("sales_discount", math.Abs(salesDiscount))
				each.Set("qty", qty)
				each.Set("discount_qty", math.Abs(s.noZero(salesDiscount/qty)))
			} else if s.Flag == "sales_return_rate" {
				each.Set("sales_return", math.Abs(salesReturn))
				each.Set("sales_revenue", netSales)
				each.Set("sales_return_rate", math.Abs(s.noZero(salesReturn/netSales)))
			} else if s.Flag == "sales_discount_by_gross_sales" {
				each.Set("sales_discount", math.Abs(salesDiscount))
				each.Set("gross_sales", grossSales)
				each.Set("sales_discount_by_gross_sales", math.Abs(s.noZero(salesDiscount/grossSales)))
			} else if s.Flag == "freight_cost_by_sales" {
				each.Set("freight_cost", math.Abs(freightExpense))
				each.Set("net_sales", netSales)
				each.Set("freight_cost_by_sales", math.Abs(s.noZero(freightExpense/netSales)))
			} else if s.Flag == "direct_labour_index" {
				each.Set("direct_abour", math.Abs(directLabour))
				each.Set("cogs", math.Abs(cogs))
				each.Set("direct_labour_index", math.Abs(s.noZero(directLabour/cogs)))
			} else if s.Flag == "material_type_index" {
				each.Set("material_local", math.Abs(materialLocal))
				each.Set("material_import", math.Abs(materialImport))
				each.Set("material_other", math.Abs(materialOther))
				each.Set("cogs", math.Abs(cogs))
				each.Set("indirect_expense_index", s.noZero(math.Abs(s.noZero((materialLocal+materialImport+materialOther))/cogs)))
			} else if s.Flag == "sga_by_sales" {
				each.Set("sga", math.Abs(sga))
				each.Set("sales", netSales)
				each.Set("sga_qty", math.Abs(s.noZero(sga/netSales)))
			} else if s.Flag == "net_price_qty" {
				each.Set("qty", math.Abs(qty))
				each.Set("netprice", netprice)
				each.Set("netprice_qty", math.Abs(s.noZero(netprice/qty)))
			} else if s.Flag == "btl_qty" {
				each.Set("btl", math.Abs(btl))
				each.Set("qty", math.Abs(qty))
				each.Set("btl_qty", math.Abs(s.noZero(btl/qty)))
			} else if s.Flag == "net_price_after_btl_qty" {
				each.Set("netpricebtl", netpricebtl)
				each.Set("qty", math.Abs(qty))
				each.Set("netpricebtl_qty", math.Abs(s.noZero(netpricebtl/qty)))
			} else if s.Flag == "cost_by_sales" {
				each.Set("cost", math.Abs(cogs))
				each.Set("sales", netSales)
				each.Set("cost_qty", math.Abs(s.noZero(cogs/netSales)))
			} else if s.Flag == "sales_by_outlet" {
				each.Set("sales", netSales)
				each.Set("outlet", countOutlet)
				each.Set("sales_outlet", math.Abs(s.noZero(netSales/countOutlet)))
			} else if s.Flag == "number_of_outlets" {
				each.Set("outlet", countOutlet)
			} else if s.Flag == "indirect_expense_index" {
				each.Set("personnel", math.Abs(indirectPersonnel))
				each.Set("services", math.Abs(indirectServices))
				each.Set("rent", math.Abs(indirectRent))
				each.Set("transportation", math.Abs(indirectTransportation))
				each.Set("maintenance", math.Abs(indirectMaintenance))
				each.Set("amort", math.Abs(indirectAmort))
				each.Set("energy", math.Abs(indirectEnergy))
				each.Set("other", math.Abs(indirectOther))
				each.Set("cogs", math.Abs(cogs))
				each.Set("indirect_cogs", s.noZero(math.Abs((s.noZero(indirectPersonnel)+s.noZero(indirectServices)+s.noZero(indirectRent)+s.noZero(indirectTransportation)+s.noZero(indirectAmort)+s.noZero(indirectEnergy)+s.noZero(indirectOther))/cogs)))
			} else if s.Flag == "marketing_expense_index" {
				each.Set("advertising", math.Abs(advertising))
				each.Set("bonus", math.Abs(bonus))
				each.Set("gondola", math.Abs(gondola))
				each.Set("otheradvertising", math.Abs(otheradvertising))
				each.Set("sales", netSales)
				each.Set("sales_outlet", s.noZero(math.Abs(s.noZero((advertising+bonus+gondola+otheradvertising)/netSales))))
			} else if s.Flag == "sga_cost_ratio" {
				each.Set("personnel", s.noZero(math.Abs(personnelga/sga)))
				each.Set("general", s.noZero(math.Abs(generalga/sga)))
				each.Set("depr", s.noZero(math.Abs(deprga/sga)))
				each.Set("foreign", s.noZero(math.Abs(foreignga/sga)))
			} else if s.Flag == "non_sales_pnl_items" {
				each.Set("directexpenses", math.Abs(directExpenses))
				each.Set("indirectExpense", math.Abs(indirectExpense))
				each.Set("depr", math.Abs(cogs))
				each.Set("sales", math.Abs(netSales))
				each.Set("nonsales", s.noZero(math.Abs((directExpenses+indirectExpense+cogs)/netSales)))
			}
			// else if s.Flag == "marketing_efficiency_btl" {
			// 	each.Set("advertising", math.Abs(advertising))
			// 	each.Set("bonus", math.Abs(bonus))
			// 	each.Set("gondola", math.Abs(gondola))
			// 	each.Set("otheradvertising", math.Abs(otheradvertising))
			// 	each.Set("btl", math.Abs(btl))
			// 	each.Set("marketing_btl", s.noZero(math.Abs(s.noZero((advertising+bonus+gondola+otheradvertising)/btl))))
			// }

			for k, v := range raw.Get("_id").(toolkit.M) {
				each.Set(strings.Replace(k, "_id_", "", -1), strings.TrimSpace(fmt.Sprintf("%v", v)))
			}

			res = append(res, &each)
		}

		*data = res
	} else {
		for _, each := range *data {
			for key := range *each {
				if strings.Contains(key, "PL") {
					val := each.GetFloat64(key)
					if math.IsNaN(val) {
						each.Set(key, 0)
					}
				}
			}
		}
	}

	return data
}

func (s *PLFinderParam) GetPLData() ([]*toolkit.M, error) {
	if s.Flag != "" {
		s.PLs = []string{}
	}

	tableName := s.GetTableName()
	plmodels, err := s.GetPLModelsFollowPLS()
	if err != nil {
		return nil, err

	}

	db, session, err := s.ConnectToDB()
	if err != nil {
		return nil, err
	}
	defer session.Close()

	groups := bson.M{}
	groupIds := bson.M{}

	fb := DB().Connection.Fb()
	fb.AddFilter(s.ParseFilter())
	matches, err := fb.Build()
	if err != nil {
		return nil, err
	}

	for _, breakdown := range s.Breakdowns {
		field := fmt.Sprintf("$%s.%s", s.TableKey, strings.Replace(breakdown, ".", "_", -1))
		alias := strings.Replace(fmt.Sprintf("_id.%s", breakdown), ".", "_", -1)
		groupIds[alias] = field
	}
	groups["_id"] = groupIds

	for _, plmod := range plmodels {
		op := fmt.Sprintf("$%s", s.Aggr)
		field := fmt.Sprintf("$%s", plmod.ID)
		groups[plmod.ID] = bson.M{op: field}
	}

	if s.Flag != "" {
		fields := []string{
			"grossamount",
			"ratiotoglobalsales",
			"ratiotobrandsales",
			"discountamount",
			"salesqty",
			"count",
			"ratiotobranchsales",
			"ratiotoskusales",
			"taxamount",
			"netamount",
			// "totaloutlet",
		}

		for _, other := range fields {
			field := fmt.Sprintf("$%s", other)
			groups[other] = bson.M{"$sum": field}
		}
	}

	// groups["totalOutlet"] = bson.M{"$size": "$outlets"}
	pipe := []bson.M{{"$match": matches}, {"$group": groups}} //, {"$project": projects}} //

	res := []*toolkit.M{}
	err = db.C(tableName).Pipe(pipe).AllowDiskUse().All(&res)
	if err != nil {
		return nil, err
	}

	resFinal := *(s.CalculatePL(&res))
	return resFinal, nil
}

func (s *PLFinderParam) GeneratePLData() error {
	tableName := s.GetTableName()

	plmodels, err := PLModelGetAll()
	if err != nil {
		return err
	}

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
		val := fmt.Sprintf("$%s", each)
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
		field := fmt.Sprintf("$pldatas.%s.amount", plmod.ID)
		group[key] = bson.M{"$sum": field}
	}

	group["outlets"] = bson.M{"$addToSet": "$customer._id"}
	// project := bson.M{"totaloutlet": bson.M{"$size": "$outlets"}}
	// for key := range group {
	// 	if key == "_id" {
	// 		continue
	// 	}

	// 	project[key] = 1
	// }

	pipes := []bson.M{{"$group": group} /**{"$project": project}, */, {"$out": tableName}}
	pipe := col.Pipe(pipes)

	res := []*toolkit.M{}
	err = pipe.AllowDiskUse().All(&res)
	if err != nil {
		return err
	}

	_ = res
	return nil
}

type PLFinderDetail struct {
	PLFinderParam

	PageSize int `json:"pageSize"`
	Take     int `json:"take"`
	Skip     int `json:"skip"`
	Page     int `json:"page"`
}

func (p *PLFinderDetail) GetData() ([]*toolkit.M, error) {
	db, ses, err := p.ConnectToDB()
	if err != nil {
		return nil, err
	}
	defer ses.Close()

	filters := bson.M{}
	for _, filter := range p.Filters {
		filters[filter.Field] = filter.Value
	}

	col := db.C(new(SalesPL).TableName())

	fmt.Printf("----- %#v\n", filters)

	data := []*toolkit.M{}
	err = col.Find(filters).Limit(p.Take).Skip(p.Skip).All(&data)
	if err != nil {
		return nil, err
	}
	fmt.Printf("----- %#v\n", data)

	return data, nil
}
