package controller

import (
	"eaciit/gdrj/web/model"
	"github.com/eaciit/knot/knot.v1"
	"github.com/eaciit/toolkit"
)

type PageController struct {
	App
	Params toolkit.M
}

func CreatePageController(AppName string) *PageController {
	var controller = new(PageController)
	controller.Params = toolkit.M{"AppName": AppName}
	return controller
}

func (w *PageController) Index(r *knot.WebContext) interface{} {
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-index.html"

	return w.Params
}

func (w *PageController) Login(r *knot.WebContext) interface{} {
	r.Config.OutputType = knot.OutputTemplate
	r.Config.ViewName = "page-login.html"

	return w.Params
}

func (w *PageController) DataBrowser(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-databrowser.html"

	return w.Params
}

func (w *PageController) UploadData(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-uploaddata.html"

	return w.Params
}

func (w *PageController) ReportChartComparison(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report.html"

	return toolkit.M{"subreport": "page-report-chart-comparison.html"}
}

func (w *PageController) AllocationFlow(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-allocation-flow.html"

	return w.Params
}

func (w *PageController) Access(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-access.html"

	return w.Params
}

func (w *PageController) Group(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-group.html"

	return w.Params
}

func (w *PageController) Session(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-session.html"

	return w.Params
}

func (w *PageController) Log(r *knot.WebContext) interface{} {
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-log.html"

	return w.Params
}

func (w *PageController) AdminTable(r *knot.WebContext) interface{} {
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-admintable.html"

	return w.Params
}

func (w *PageController) User(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-user.html"

	return w.Params
}

func (w *PageController) Organization(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-organization.html"

	return w.Params
}

func (w *PageController) PNLPerformance(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-pnlperformance.html"

	return w.Params
}

func (w *PageController) BranchAnalysis(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-branchanalysis.html"

	return w.Params
}

func (w *PageController) KeyAccountAnalysis(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-keyaccount.html"

	return w.Params
}

func (w *PageController) RDAnalysis(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-rdanalysis.html"

	return w.Params
}

func (w *PageController) Dashboard(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-dashboard.html"

	return w.Params
}

func (w *PageController) CustomAnalysis(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-customanalysis.html"

	return w.Params
}

func (w *PageController) Home(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-landing.html"

	return w.Params
}

func (w *PageController) GrowthAnalysis(r *knot.WebContext) interface{} {
	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
	r.Config.OutputType = knot.OutputTemplate
	r.Config.LayoutTemplate = LayoutFile
	r.Config.ViewName = "page-report-growthanalysis.html"

	return w.Params
}

// func (w *PageController) PageReport(r *knot.WebContext, args []string) interface{} {
// 	gocore.WriteLog(r.Session("sessionid", ""), "access", r.Request.URL.String())
// 	r.Config.OutputType = knot.OutputTemplate
// 	r.Config.LayoutTemplate = LayoutFile
// 	r.Config.ViewName = "page-report.html"

// 	if len(args) == 0 {
// 		return toolkit.M{"subreport": false}
// 	}

// 	var id, name string = args[0], ""
// 	var value1, value2, value3 string

// 	switch id {
// 	case "gross_sales_discount_and_net_sales":
// 		name = "Gross Sales, Discount, and Net Sales"
// 		value1 = "Gross Sales"
// 		value2 = "Discount"
// 		value3 = "Net Sales"
// 	}

// 	return toolkit.M{
// 		"id":     id,
// 		"name":   name,
// 		"value1": value1,
// 		"value2": value2,
// 		"value3": value3,
// 	}
// }
