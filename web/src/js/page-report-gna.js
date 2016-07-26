viewModel.gna = {}
let gna = viewModel.gna


gna.contentIsLoading = ko.observable(false)
gna.breakdownNote = ko.observable('')

gna.breakdownBy = ko.observable('customer.channelname')
gna.breakdownValue = ko.observableArray([])
gna.breakdownByFiscalYear = ko.observable('date.fiscal')

gna.data = ko.observableArray([])
gna.fiscalYear = ko.observable(rpt.value.FiscalYear())
gna.level = ko.observable(1)

gna.refresh = (useCache = false) => {
	let param = {}
	param.pls = []
	param.aggr = 'sum'
	param.flag = 'gna'
	param.filters = rpt.getFilterValue(false, gna.fiscalYear)
	param.groups = rpt.parseGroups([gna.breakdownBy()])
	gna.contentIsLoading(true)

	let breakdownValue = gna.breakdownValue().filter((d) => d !== 'All')
	if (breakdownValue.length > 0) {
		param.filters.push({
			Field: gna.breakdownBy(),
			Op: '$in',
			Value: breakdownValue
		})
	}

	let fetch = () => {
		rpt.injectMonthQuarterFilter(param.filters)
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => {
					fetch()
				}, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				gna.contentIsLoading(false)
				return
			}

			res.Data = rpt.hardcodePLGA(res.Data.Data, res.Data.PLModels)
			let data = gna.buildStructure(res.Data.Data)
			gna.data(data)
			let plmodels = gna.buildPLModels(res.Data.PLModels)
			rpt.plmodels(plmodels)
			gna.emptyGrid()
			gna.contentIsLoading(false)
			gna.render()
			rpt.showExpandAll(true)
			rpt.prepareEvents()
		}, () => {
			gna.emptyGrid()
			gna.contentIsLoading(false)
		})
	}

	fetch()
}

gna.buildPLModels = (plmodels) => {
	let parsePLs = []
	let pls = ["PL8A", "PL33", "PL34", "PL35"]

	plmodels.forEach((d) => {
		pls.forEach((e) => {
			if (d._id.indexOf(e) > -1) {
				let o = {}
				o._id = d._id
				o.OrderIndex = d.OrderIndex
				o.PLHeader1 = d.PLHeader2
				o.PLHeader2 = d.PLHeader3.split('_').reverse()[0]
				o.PLHeader3 = d.PLHeader3
				o.GLReff = ''
				o.Amount = 0

				parsePLs.push(o)
			}
		})
	})

	console.log(parsePLs)
	return parsePLs
}

gna.clickExpand = (e) => {
	let right = $(e).find('i.fa-chevron-right').length, down = 0
		if (e.attr('idheaderpl') == 'PL0')
			down = $(e).find('i.fa-chevron-up').length
		else
			down = $(e).find('i.fa-chevron-down').length
	if (right > 0){
		if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
			$('.pivot-pnl .table-header').css('width', rpt.pnlTableHeaderWidth())
			$('.pivot-pnl .table-content').css('margin-left', rpt.pnlTableHeaderWidth())
		}

		$(e).find('i').removeClass('fa-chevron-right')
		if (e.attr('idheaderpl') == 'PL0')
			$(e).find('i').addClass('fa-chevron-up')
		else
			$(e).find('i').addClass('fa-chevron-down')
		$(`tr[idparent=${e.attr('idheaderpl')}]`).css('display', '')
		$(`tr[idcontparent=${e.attr('idheaderpl')}]`).css('display', '')
		$(`tr[statusvaltemp=hide]`).css('display', 'none')
		rpt.refreshHeight(e.attr('idheaderpl'))
		rpt.refreshchildadd(e.attr('idheaderpl'))
	}
	if (down > 0) {
		if (['PL28', 'PL29A', 'PL31'].indexOf($(e).attr('idheaderpl')) > -1) {
			$('.pivot-pnl .table-header').css('width', '')
			$('.pivot-pnl .table-content').css('margin-left', '')
		}
		
		$(e).find('i').removeClass('fa-chevron-up')
		$(e).find('i').removeClass('fa-chevron-down')
		$(e).find('i').addClass('fa-chevron-right')
		$(`tr[idparent=${e.attr('idheaderpl')}]`).css('display', 'none')
		$(`tr[idcontparent=${e.attr('idheaderpl')}]`).css('display', 'none')
		rpt.hideAllChild(e.attr('idheaderpl'))
	}
}

gna.emptyGrid = () => {
	$('#gna').replaceWith(`<div class="breakdown-view ez" id="gna"></div>`)
}

gna.buildStructure = (data) => {
	let groupThenMap = (data, group) => {
		let op1 = _.groupBy(data, (d) => group(d))
		let op2 = _.map(op1, (v, k) => {
			let key = { _id: k, subs: v }
			let sample = v[0]

			for (let prop in sample) {
				if (sample.hasOwnProperty(prop) && prop != '_id') {
					key[prop] = toolkit.sum(v, (d) => d[prop])
				}
			}

			return key
		})

		return op2
	}

	let parsed = groupThenMap(data, (d) => {
		return d._id[`_id_${toolkit.replace(gna.breakdownBy(), '.', '_')}`]
	}).map((d) => {
		d.breakdowns = d.subs[0]._id
		d.count = 1

		return d
	})

	gna.level(1)
	let newParsed = _.orderBy(parsed, (d) => {
		return rpt.orderByChannel(d._id, d.PL8A)
	}, 'desc')
	return newParsed
}

gna.render = () => {
	if (gna.data().length == 0) {
		$('#gna').html('No data found.')
		return
	}


	// ========================= TABLE STRUCTURE

	let percentageWidth = 100

	let wrapper = toolkit.newEl('div')
		.addClass('pivot-pnl-branch pivot-pnl')
		.appendTo($('#gna'))

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

	let trHeader = toolkit.newEl('tr')
		.appendTo(tableHeader)

	toolkit.newEl('th')
		.html('P&L')
		.css('height', `${rpt.rowHeaderHeight() * gna.level()}px`)
		.attr('data-rowspan', gna.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header')
		.appendTo(trHeader)

	toolkit.newEl('th')
		.html('Total')
		.css('height', `${rpt.rowHeaderHeight() * gna.level()}px`)
		.attr('data-rowspan', gna.level())
		.css('vertical-align', 'middle')
		.addClass('cell-percentage-header align-right')
		.appendTo(trHeader)

	toolkit.newEl('th')
		.html('% of N Sales')
		.css('height', `${rpt.rowHeaderHeight() * gna.level()}px`)
		.css('vertical-align', 'middle')
		.css('font-weight', 'normal')
		.css('font-style', 'italic')
		.width(percentageWidth - 20)
		.attr('data-rowspan', gna.level())
		.addClass('cell-percentage-header align-right')
		.appendTo(trHeader)

	let trContents = []
	for (let i = 0; i < gna.level(); i++) {
		trContents.push(toolkit.newEl('tr')
			.appendTo(tableContent)
			.css('height', `${rpt.rowHeaderHeight()}px`))
	}



	// ========================= BUILD HEADER

	let data = gna.data()

	let columnWidth = 130
	let totalColumnWidth = 0
	let pnlTotalSum = 0
	let dataFlat = []

	let countWidthThenPush = (thheader, each, key) => {
		let currentColumnWidth = each._id.length * 10
		if (currentColumnWidth < columnWidth) {
			currentColumnWidth = columnWidth
		}

		if (each.hasOwnProperty('width')) {
			currentColumnWidth = each.width
		}

		each.key = key.join('_')
		dataFlat.push(each)

		totalColumnWidth += currentColumnWidth
		thheader.width(currentColumnWidth)
	}

	data.forEach((lvl1, i) => {
		let thheader1 = toolkit.newEl('th')
			.html(lvl1._id)
			.attr('colspan', lvl1.count)
			.addClass('align-center')
			.css('border-top', 'none')
			.appendTo(trContents[0])

		if (gna.level() == 1) {
			countWidthThenPush(thheader1, lvl1, [lvl1._id])

			totalColumnWidth += percentageWidth
			let thheader1p = toolkit.newEl('th')
				.html('% of N Sales')
				.width(percentageWidth)
				.addClass('align-center')
				.css('font-weight', 'normal')
				.css('font-style', 'italic')
				.css('border-top', 'none')
				.appendTo(trContents[0])

			return
		}
		thheader1.attr('colspan', lvl1.count * 2)

		lvl1.subs.forEach((lvl2, j) => {
			let thheader2 = toolkit.newEl('th')
				.html(lvl2._id)
				.addClass('align-center')
				.appendTo(trContents[1])

			if (gna.level() == 2) {
				countWidthThenPush(thheader2, lvl2, [lvl1._id, lvl2._id])

				totalColumnWidth += percentageWidth
				let thheader1p = toolkit.newEl('th')
					.html('% of N Sales')
					.width(percentageWidth)
					.addClass('align-center')
					.css('font-weight', 'normal')
					.css('font-style', 'italic')
					.appendTo(trContents[1])

				return
			}
			thheader2.attr('colspan', lvl2.count)
		})
	})

	tableContent.css('min-width', totalColumnWidth)



	// ========================= CONSTRUCT DATA
	
	let plmodels = _.sortBy(rpt.plmodels(), (d) => parseInt(d.OrderIndex.replace(/PL/g, '')))
	let exceptions = ["PL94C" /* "Operating Income" */, "PL39B" /* "Earning Before Tax" */, "PL41C" /* "Earning After Tax" */, "PL6A" /* "Discount" */]
	let netSalesPLCode = 'PL8A'
	let netSalesRow = {}
	let grossSalesPLCode = 'PL0'
	let grossSalesRow = {}
	let discountActivityPLCode = 'PL7A'
	let rows = []

	rpt.fixRowValue(dataFlat)

	console.log("dataFlat", dataFlat)

	dataFlat.forEach((e) => {
		let breakdown = e.key
		netSalesRow[breakdown] = e[netSalesPLCode]
		grossSalesRow[breakdown] = e[grossSalesPLCode]
	})

	plmodels.forEach((d) => {
		let row = { PNL: d.PLHeader3, PLCode: d._id, PNLTotal: 0, Percentage: 0 }
		dataFlat.forEach((e) => {
			let breakdown = e.key
			let value = e[`${d._id}`]; 
			row[breakdown] = value

			if (toolkit.isDefined(e.excludeFromTotal)) {
				return
			}

			row.PNLTotal += value
		})
		dataFlat.forEach((e) => {
			let breakdown = e.key
			let percentage = toolkit.number(row[breakdown] / row.PNLTotal) * 100; 
			percentage = toolkit.number(percentage)

			if (d._id == discountActivityPLCode) {
				percentage = toolkit.number(row[breakdown] / grossSalesRow[breakdown]) * 100
			} else if (d._id != netSalesPLCode) {
				percentage = toolkit.number(row[breakdown] / netSalesRow[breakdown]) * 100
			}

			if (percentage < 0)
				percentage = percentage * -1

			row[`${breakdown} %`] = percentage
		})

		if (exceptions.indexOf(row.PLCode) > -1) {
			return
		}

		rows.push(row)
	})

	console.log("rows", rows)
	
	let TotalNetSales = _.find(rows, (r) => { return r.PLCode == netSalesPLCode }).PNLTotal
	// let TotalGrossSales = _.find(rows, (r) => { return r.PLCode == grossSalesPLCode }).PNLTotal
	rows.forEach((d, e) => {
		let TotalPercentage = (d.PNLTotal / TotalNetSales) * 100
		// if (d.PLCode == discountActivityPLCode) {
		// 	TotalPercentage = (d.PNLTotal / TotalGrossSales) * 100
		// }

		if (TotalPercentage < 0)
			TotalPercentage = TotalPercentage * -1 
		rows[e].Percentage = toolkit.number(TotalPercentage)
	})




	// ========================= PLOT DATA

	rows.forEach((d, i) => {
		pnlTotalSum += d.PNLTotal

		let PL = d.PLCode
		PL = PL.replace(/\s+/g, '')
		let trHeader = toolkit.newEl('tr')
			.addClass(`header${PL}`)
			.attr(`idheaderpl`, PL)
			.attr(`data-row`, `row-${i}`)
			.css('height', `${rpt.rowContentHeight()}px`)
			.appendTo(tableHeader)

		trHeader.on('click', () => {
			gna.clickExpand(trHeader)
		})

		toolkit.newEl('td')
			.html('<i></i>' + d.PNL)
			.appendTo(trHeader)

		let pnlTotal = kendo.toString(d.PNLTotal, 'n0')
		toolkit.newEl('td')
			.html(pnlTotal)
			.addClass('align-right')
			.appendTo(trHeader)

		toolkit.newEl('td')
			.html(kendo.toString(d.Percentage, 'n2') + ' %')
			.addClass('align-right')
			.appendTo(trHeader)

		let trContent = toolkit.newEl('tr')
			.addClass(`column${PL}`)
			.attr(`idpl`, PL)
			.attr(`data-row`, `row-${i}`)
			.css('height', `${rpt.rowContentHeight()}px`)
			.appendTo(tableContent)

		dataFlat.forEach((e, f) => {
			let key = e.key
			let value = kendo.toString(d[key], 'n0')
			let percentage = kendo.toString(d[`${key} %`], 'n2') + ' %'

			if ($.trim(value) == '') {
				value = 0
			}

			let cell = toolkit.newEl('td')
				.html(value)
				.addClass('align-right')
				.appendTo(trContent)

			let cellPercentage = toolkit.newEl('td')
				.html(percentage)
				.addClass('align-right')
				.appendTo(trContent)

			$([cell, cellPercentage]).on('click', () => {
				gna.renderDetail(d.PLCode, e.breakdowns)
			})
		})

		let boolStatus = false
		trContent.find('td').each((a,e) => {
			if ($(e).text() != '0' && $(e).text() != '0.00 %') {
				boolStatus = true
			}
		})

		if (boolStatus) {
			trContent.attr('statusval', 'show')
			trHeader.attr('statusval', 'show')
		} else {
			trContent.attr('statusval', 'hide')
			trHeader.attr('statusval', 'hide')
		}
	})
	

	// ========================= CONFIGURE THE HIRARCHY
	rpt.buildGridLevels(rows)
}







gna.optionBreakdownValues = ko.observableArray([])
gna.breakdownValueAll = { _id: 'All', Name: 'All' }
gna.changeBreakdown = () => {
	let all = gna.breakdownValueAll
	let map = (arr) => arr.map((d) => {
		if ("customer.channelname" == gna.breakdownBy()) {
			return d
		}
		if ("customer.keyaccount" == gna.breakdownBy()) {
			return { _id: d._id, Name: d._id }
		}

		return { _id: d.Name, Name: d.Name }
	})
	setTimeout(() => {
		gna.breakdownValue([])

		switch (gna.breakdownBy()) {
			case "customer.areaname":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.Area())))
				gna.breakdownValue([all._id])
			break;
			case "customer.region":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.Region())))
				gna.breakdownValue([all._id])
			break;
			case "customer.zone":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.Zone())))
				gna.breakdownValue([all._id])
			break;
			case "product.brand":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.Brand())))
				gna.breakdownValue([all._id])
			break;
			case "customer.branchname":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.Branch())))
				gna.breakdownValue([all._id])
			break;
			case "customer.branchgroup":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.BranchGroup())))
				gna.breakdownValue([all._id])
			break;
			case "customer.channelname":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.Channel())))
				gna.breakdownValue([all._id])
			break;
			case "customer.keyaccount":
				gna.optionBreakdownValues([all].concat(map(rpt.masterData.KeyAccount())))
				gna.breakdownValue([all._id])
			break;
		}
	}, 100)
}
gna.changeBreakdownValue = () => {
	let all = gna.breakdownValueAll
	setTimeout(() => {
		let condA1 = gna.breakdownValue().length == 2
		let condA2 = gna.breakdownValue().indexOf(all._id) == 0
		if (condA1 && condA2) {
			gna.breakdownValue.remove(all._id)
			return
		}

		let condB1 = gna.breakdownValue().length > 1
		let condB2 = gna.breakdownValue().reverse()[0] == all._id
		if (condB1 && condB2) {
			gna.breakdownValue([all._id])
			return
		}

		let condC1 = gna.breakdownValue().length == 0
		if (condC1) {
			gna.breakdownValue([all._id])
		}
	}, 100)
}





vm.currentMenu('Analysis')
vm.currentTitle('G&A Analysis')
vm.breadcrumb([
	{ title: 'Godrej', href: viewModel.appName + 'page/landing' },
	{ title: 'Home', href: viewModel.appName + 'page/landing' },
	{ title: 'G&A Analysis', href: '#' }
])

rpt.refresh = () => {
	gna.changeBreakdown()
	gna.changeBreakdownValue()
	setTimeout(() => {
		gna.breakdownValue(['All'])
		gna.refresh()
	}, 200)
}

$(() => {
	rpt.refresh()
	rpt.showExport(true)
})
