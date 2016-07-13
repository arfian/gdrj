package controller

import (
	"eaciit/gdrj/model"
	"sort"
	"strings"

	"github.com/eaciit/knot/knot.v1"
	"github.com/eaciit/toolkit"
)

type GrowthController struct {
	App
}

type GrowthParm struct {
	BreakDown    string
	SeriesFields []string
}

type GrowthObject struct {
	Key      string
	KeyOrder int
	Values1, Values2,
	Growths, GrowthPcts map[string]float64
}

func NewGrowthObject(key string) *GrowthObject {
	return &GrowthObject{key, 0, map[string]float64{}, map[string]float64{}, map[string]float64{}, map[string]float64{}}
}

func (c *GrowthController) GetGrowthData(r *knot.WebContext) interface{} {
	result := toolkit.NewResult()
	r.Config.OutputType = knot.OutputJson

	gparm := new(GrowthParm)
	if eparm := r.GetPayload(gparm); eparm != nil {
		return result.SetErrorTxt(toolkit.Sprintf("Payload: " + eparm.Error()))
	}

	filters := []string{"date_fiscal"}
	filters = append(filters, gparm.BreakDown)
	sort.Strings(filters)
	tablename := "pl_" + strings.Join(filters, "_")

	growths := map[string]*GrowthObject{}

	cursor, _ := gdrj.DB().Connection.NewQuery().From(tablename).Select().Cursor(nil)
	for {
		mr := new(toolkit.M)
		if ef := cursor.Fetch(mr, 1, false); ef != nil {
			break
		}
		key := mr.Get("key", toolkit.M{}).(toolkit.M)
		fiscal := key.GetString("date_fiscal")
		breakdown := key.GetString(gparm.BreakDown)
		growth := growths[breakdown]
		if growth == nil {
			growth = NewGrowthObject(breakdown)
		}

		for _, sf := range gparm.SeriesFields {
			value := mr.GetFloat64(sf)
			f1, f2 := float64(0), float64(0)
			if fiscal == "2014-2015" {
				f1 = value
				growth.Values1[sf] = value
			} else if fiscal == "2015-2016" {
				f2 = value
				growth.Values2[sf] = value
			} else {
				continue
			}

			growth.Growths[sf] = toolkit.Div(f1, f2)
		}

		growths[breakdown] = growth
	}
	return result
}
