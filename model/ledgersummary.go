package gdrj

import (
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/eaciit/dbox"
	"github.com/eaciit/orm/v1"
	"github.com/eaciit/toolkit"
)

var (
	summaryTableName = "ledgersummariestemp"
)

type LedgerSummary struct {
	orm.ModelBase                          `bson:"-" json:"-"`
	ID                                     string `bson:"_id"`
	PC                                     *ProfitCenter
	CC                                     *CostCenter
	PLModel                                *PLModel
	CompanyCode                            string
	LedgerAccount                          string
	Customer                               *Customer
	Product                                *Product
	Date                                   *Date
	PLGroup1, PLGroup2, PLGroup3, PLGroup4 string
	Value1, Value2, Value3                 float64
	//EasyForSelect
	PCID, CCID, OutletID, SKUID, PLCode, PLOrder string
	Month                                        time.Month
	Year                                         int
}

// month,year
func (s *LedgerSummary) RecordID() interface{} {
	return s.ID
	//return toolkit.Sprintf("%d_%d_%s_%s", s.Date.Year, s.Date.Month, s.CompanyCode, s.LedgerAccount)
}

func (s *LedgerSummary) PrepareID() interface{} {
	return toolkit.Sprintf("%d_%d_%s_%s_%s_%s_%s_%s_%s",
		s.Date.Year, s.Date.Month,
		s.CompanyCode, s.LedgerAccount,
		s.PLCode, s.OutletID, s.SKUID, s.PCID, s.CCID)
}

func (s *LedgerSummary) TableName() string {
	return "ledgersummaries"
}

func (s *LedgerSummary) PreSave() error {
	s.ID = s.PrepareID().(string)
	return nil
}

func GetLedgerSummaryByDetail(LedgerAccount, PCID, CCID, OutletID, SKUID string, Year int, Month time.Month) (ls *LedgerSummary) {
	ls = new(LedgerSummary)

	filter := dbox.And(dbox.Eq("month", Month),
		dbox.Eq("year", Year),
		dbox.Eq("ledgeraccount", LedgerAccount),
		dbox.Eq("pcid", PCID),
		dbox.Eq("ccid", CCID),
		dbox.Eq("outletid", OutletID),
		dbox.Eq("skuid", SKUID))

	cr, err := Find(new(LedgerSummary), filter, nil)
	if err != nil {
		return
	}

	_ = cr.Fetch(&ls, 1, false)
	cr.Close()

	return
}

func CalculateLedgerSummaryAnalysisIdea(payload *PivotParam) ([]*toolkit.M, error) {
	var filter *dbox.Filter = payload.ParseFilter()

	conn := DB().Connection
	q := conn.NewQuery().From(summaryTableName)
	q = q.Where(filter)
	q = q.Group("plmodel._id", "plmodel.plheader1", "plmodel.plheader2", "plmodel.plheader3")
	q = q.Aggr(dbox.AggrSum, "$value1", "value1")

	c, e := q.Cursor(nil)
	if e != nil {
		return nil, errors.New("SummarizedLedgerSum: Preparing cursor error " + e.Error())
	}
	defer c.Close()

	ms := []*toolkit.M{}
	e = c.Fetch(&ms, 0, false)
	if e != nil {
		return nil, errors.New("SummarizedLedgerSum: Fetch cursor error " + e.Error())
	}

	res := []*toolkit.M{}
	for _, each := range ms {
		o := toolkit.M{}
		o.Set("_id", each.Get("_id").(toolkit.M).Get("plmodel._id"))
		o.Set("plheader1", each.Get("_id").(toolkit.M).Get("plmodel.plheader1"))
		o.Set("plheader2", each.Get("_id").(toolkit.M).Get("plmodel.plheader2"))
		o.Set("plheader3", each.Get("_id").(toolkit.M).Get("plmodel.plheader3"))
		o.Set("value", each.Get("value1"))
		res = append(res, &o)
	}

	return res, nil
}

func CalculateLedgerSummary(payload *PivotParam) ([]*toolkit.M, error) {
	var filter *dbox.Filter = payload.ParseFilter()
	var columns []string = payload.ParseDimensions()
	var datapoints []string = payload.ParseDataPoints()
	var fnTransform (func(m *toolkit.M) error) = nil

	fmt.Printf("--- %#v\n", filter)
	fmt.Printf("--- %#v\n", columns)
	fmt.Printf("--- %#v\n", datapoints)

	fmt.Printf("+++++ %#v\n", *(filter.Value.([]*dbox.Filter)[0]))
	fmt.Printf("+++++ %#v\n", *(filter.Value.([]*dbox.Filter)[1]))

	var plFilter1, plFilter2, plFilter3 *dbox.Filter

	if payload.Which == "gross_sales_discount_and_net_sales" {
		plFilter1 = dbox.Eq("plcode", "PL1")
		plFilter2 = dbox.Eq("plcode", "PL2")
		plFilter3 = dbox.Eq("plcode", "PL3")
	}

	bunchData1, err := SummarizeLedgerSum(
		dbox.And(plFilter1, filter), columns, datapoints, fnTransform)
	if err != nil {
		return nil, err
	}

	bunchData2, err := SummarizeLedgerSum(
		dbox.And(plFilter2, filter), columns, datapoints, fnTransform)
	if err != nil {
		return nil, err
	}

	bunchData3, err := SummarizeLedgerSum(
		dbox.And(plFilter3, filter), columns, datapoints, fnTransform)
	if err != nil {
		return nil, err
	}

	allKeys := map[string]*toolkit.M{}
	rows := []*toolkit.M{}

	for _, each := range bunchData1 {
		keyword := ""
		for _, s := range columns {
			keyword = fmt.Sprintf("%s%s", keyword, each.Get("_id").(toolkit.M).GetString(s))
		}

		if _, ok := allKeys[keyword]; !ok {
			allKeys[keyword] = each
			rows = append(rows, each)

			for key, val := range *each {
				if key == "_id" {
					for skey, sval := range val.(toolkit.M) {
						each.Set(strings.Replace(skey, ".", "_", -1), sval)
					}
				}
			}
			each.Unset("_id")
		} else {
			current := allKeys[keyword]
			current.Set("value1", current.GetFloat64("value1")+each.GetFloat64("value1"))
		}
	}

	for _, each := range bunchData2 {
		keyword := ""
		for _, s := range columns {
			keyword = fmt.Sprintf("%s%s", keyword, each.Get("_id").(toolkit.M).GetString(s))
		}

		if _, ok := allKeys[keyword]; !ok {
			allKeys[keyword] = each
			rows = append(rows, each)
			each.Set("value2", each.GetFloat64("value1"))
			each.Set("value1", 0)

			for key, val := range *each {
				if key == "_id" {
					for skey, sval := range val.(toolkit.M) {
						each.Set(strings.Replace(skey, ".", "_", -1), sval)
					}
				}
			}
			each.Unset("_id")
		} else {
			current := allKeys[keyword]
			current.Set("value2", current.GetFloat64("value2")+each.GetFloat64("value1"))
		}
	}

	for _, each := range bunchData3 {
		keyword := ""
		for _, s := range columns {
			keyword = fmt.Sprintf("%s%s", keyword, each.Get("_id").(toolkit.M).GetString(s))
		}

		if _, ok := allKeys[keyword]; !ok {
			allKeys[keyword] = each
			rows = append(rows, each)
			each.Set("value3", each.GetFloat64("value1"))
			each.Set("value1", 0)

			for key, val := range *each {
				if key == "_id" {
					for skey, sval := range val.(toolkit.M) {
						each.Set(strings.Replace(skey, ".", "_", -1), sval)
					}
				}
			}
			each.Unset("_id")
		} else {
			current := allKeys[keyword]
			current.Set("value3", current.GetFloat64("value3")+each.GetFloat64("value1"))
		}
	}

	return rows, nil
}

func SummarizeLedgerSum(
	filter *dbox.Filter,
	columns []string,
	datapoints []string,
	fnTransform func(m *toolkit.M) error) ([]*toolkit.M, error) {
	conn := DB().Connection
	q := conn.NewQuery().From(summaryTableName)
	if filter != nil {
		q = q.Where(filter)
	}

	if len(columns) > 0 {
		cs := []string{}
		for i := range columns {
			cs = append(cs, strings.ToLower(columns[i]))
		}
		q = q.Group(cs...)
	}
	if len(datapoints) == 0 {
		return nil, errors.New("SummarizedLedgerSum: Datapoints should be defined at least 1")
	}
	for _, dp := range datapoints {
		dps := strings.Split(strings.ToLower(dp), ":")
		if len(dps) < 2 {
			return nil, errors.New("SummarizeLedgerSum: Parameters should follow this pattern aggrOp:fieldName:[alias - optional]")
		}

		fieldid := dps[1]
		alias := fieldid
		op := ""
		if !strings.HasPrefix(dps[0], "$") {
			dps[0] = "$" + strings.ToLower(dps[0])
		}

		if toolkit.HasMember([]string{dbox.AggrSum, dbox.AggrAvr, dbox.AggrMax,
			dbox.AggrMin, dbox.AggrMean, dbox.AggrMed}, dps[0]) {
			op = dps[0]
		}
		if op == "" {
			return nil, errors.New("SummarizeLedgerSum: Invalid Operation")
		}
		if len(dps) > 2 {
			alias = dps[2]
		}

		if strings.HasPrefix(alias, "$") {
			alias = alias[1:]
		}

		if fnumber, enumber := toolkit.IsStringNumber(fieldid, "."); enumber == nil {
			q = q.Aggr(op, fnumber, alias)
		} else {
			q = q.Aggr(op, fieldid, alias)
		}
	}

	c, e := q.Cursor(nil)
	if e != nil {
		return nil, errors.New("SummarizedLedgerSum: Preparing cursor error " + e.Error())
	}
	defer c.Close()

	ms := []*toolkit.M{}
	e = c.Fetch(&ms, 0, false)
	if e != nil {
		return nil, errors.New("SummarizedLedgerSum: Fetch cursor error " + e.Error())
	}

	if fnTransform != nil {
		for idx, m := range ms {
			e = fnTransform(m)
			if e != nil {
				return nil, errors.New(toolkit.Sprintf("SummarizedLedgerSum: Transform error on index %d, %s",
					idx, e.Error()))
			}
		}
	}

	return ms, nil
}

func (s *LedgerSummary) Save() error {
	e := Save(s)
	if e != nil {
		return errors.New(toolkit.Sprintf("[%v-%v] Error found : ", s.TableName(), "save", e.Error()))
	}
	return e
}

type PivotParam struct {
	Dimensions []*PivotParamDimensions `json:"dimensions"`
	DataPoints []*PivotParamDataPoint  `json:"datapoints"`
	Which      string                  `json:"which"`
	Filters    []toolkit.M             `json:"filters"`
	Type       string                  `json:"type"`
}

type PivotParamDimensions struct {
	Field string `json:"field"`
}

type PivotParamDataPoint struct {
	Aggr  string `json:"aggr"`
	Field string `json:"field"`
}

func (p *PivotParam) ParseDimensions() (res []string) {
	res = []string{}
	for _, each := range p.Dimensions {
		res = append(res, each.Field)
	}
	return
}

func (p *PivotParam) ParseDataPoints() (res []string) {
	for _, each := range p.DataPoints {
		parts := []string{each.Aggr, each.Field, each.Field}

		if !strings.HasPrefix(parts[1], "$") {
			parts[1] = fmt.Sprintf("$%s", parts[1])
		}

		res = append(res, strings.Join(parts, ":"))
	}
	return
}

func (p *PivotParam) ParseFilter() *dbox.Filter {
	filters := []*dbox.Filter{}

	for _, each := range p.Filters {
		field := each.GetString("Field")

		switch each.GetString("Op") {
		case dbox.FilterOpIn:
			values := []string{}
			for _, v := range each.Get("Value").([]interface{}) {
				values = append(values, v.(string))
			}

			if len(values) > 0 {
				filters = append(filters, dbox.In(field, values))
			}
		case dbox.FilterOpGte:
			var value interface{} = each.GetString("Value")

			if value.(string) != "" {
				if field == "year" {
					t, err := time.Parse(time.RFC3339Nano, value.(string))
					if err != nil {
						fmt.Println(err.Error())
					} else {
						value = t.Year()
					}
				}

				filters = append(filters, dbox.Gte(field, value))
			}
		case dbox.FilterOpLte:
			var value interface{} = each.GetString("Value")

			if value.(string) != "" {
				if field == "year" {
					t, err := time.Parse(time.RFC3339Nano, value.(string))
					if err != nil {
						fmt.Println(err.Error())
					} else {
						value = t.Year()
					}
				}

				filters = append(filters, dbox.Lte(field, value))
			}
		case dbox.FilterOpEqual:
			value := each.GetString("Value")

			filters = append(filters, dbox.Gte(field, value))
		}
	}

	for _, each := range filters {
		fmt.Printf(">>>> %#v\n", *each)
	}

	return dbox.And(filters...)
}
