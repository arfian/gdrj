vm.currentMenu('Growth Analysis')
vm.currentTitle("&nbsp;")
vm.breadcrumb([
	{ title: 'Godrej', href: '#' },
	{ title: 'Growth Analysis', href: '/report/growthanalysis' }
])

viewModel.growth = {}
let growth = viewModel.growth

growth.fiscalYears = ko.observableArray(rpt.value.FiscalYears())
growth.contentIsLoading = ko.observable(false)
growth.data = ko.observableArray([])
growth.breakdownBy = ko.observable('customer.channelname')
growth.breakdownNote = ko.observable('')

growth.refresh = (useCache = false) => {
	// if (kac.breakdownValue().length == 0) {
	// 	toolkit.showError('Please choose at least breakdown value')
	// 	return
	// }

	let param = {}
	param.pls = []
	param.groups = rpt.parseGroups([growth.breakdownBy(), "date.year", "date.quartertxt"])
	// param.groups = rpt.parseGroups([growth.breakdownBy()])
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(false, growth.fiscalYear)

	growth.contentIsLoading(true)

	let fetch = () => {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => {
					fetch()
				}, 1000 * 5)
				return
			}

			let date = moment(res.time).format("dddd, DD MMMM YYYY HH:mm:ss")
			growth.breakdownNote(`Last refreshed on: ${date}`)

			console.log(res.Data.Data)
			growth.data(res.Data.Data)
			rpt.plmodels(res.Data.PLModels)
			growth.emptyGrid()
			growth.contentIsLoading(false)
			growth.render()
		}, () => {
			growth.emptyGrid()
			growth.contentIsLoading(false)
		}, {
			cache: (useCache == true) ? 'breakdown chart' : false
		})
	}

	fetch()
}

growth.emptyGrid = () => {
	$('.breakdown-view').replaceWith(`<div class="breakdown-view ez" id="pnl-analysis"></div>`)
}

growth.render = () => {
	let wrapper = toolkit.newEl('div')
		.addClass('pivot-pnl')
		.appendTo($('.breakdown-view'))

	let tableHeaderWrap = toolkit.newEl('div')
		.addClass('table-header')
		.appendTo(wrapper)

	let tableHeader = toolkit.newEl('table')
		.addClass('table')
		.appendTo(tableHeaderWrap)

	let tableContentWrap = toolkit.newEl('div')
		.appendTo(wrapper)
		.addClass('table-content')

	let tableContent = toolkit.newEl('table')
		.addClass('table')
		.appendTo(tableContentWrap)

	let trHeader1 = toolkit.newEl('tr')
		.appendTo(tableHeader)
}

rpt.refresh = () => {
	rpt.tabbedContent()
	// rpt.refreshView('analysis')

	// rs.getSalesHeaderList()

	// bkd.changeBreakdown()
	setTimeout(() => {
		// bkd.breakdownValue(['All'])
		growth.refresh(false)
		$("ul.nav-pills").find('li').removeClass("active")
		$(`a[field='${growth.breakdownBy()}']`).parent().addClass('active')
	}, 200)

	rpt.prepareEvents()

	// ccr.getDecreasedQty(false)
}

rpt.selectBreakDown = (d , e) => {
	// console.log(d, $(e.target).closest(".nav-pills"))
	$(e.target).closest(".nav-pills").find('li').removeClass("active")
	$(e.target).parent().addClass('active')
	growth.breakdownBy($(e.target).attr('field'))
}

$(() => {
	rpt.refresh()
})