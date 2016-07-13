
viewModel.salesReturn = {}
let sr = viewModel.salesReturn
sr.contentIsLoading = ko.observable(false)
sr.plGrossSales = ko.observable('PL0')
sr.plSalesReturn = ko.observable('salesreturn')
sr.breakdown = ko.observable('customer.channelname')
sr.fiscalYear = ko.observable(rpt.value.FiscalYear())
sr.title = ko.observable('Sales Return by Channels')
sr.breakdownChannels = ko.observableArray([])

sr.changeTo = (d, e) => {
	sr.title(e)
	sr.breakdown(d)
	sr.refresh()
}

sr.refresh = () => {
	let param = {}
	param.pls = []
	param.groups = rpt.parseGroups([sr.breakdown()])
	param.aggr = 'sum'
	param.filters = rpt.getFilterValue(false, sr.fiscalYear)

	if (sr.breakdownChannels().length > 0) {
		param.groups.push('customer.reportsubchannel')
		param.filters.push({
			Field: 'customer.channelname',
			Op: '$in',
			Value: sr.breakdownChannels()
		})
	}

	let fetch = () => {
		toolkit.ajaxPost(viewModel.appName + "report/getpnldatanew", param, (res) => {
			if (res.Status == "NOK") {
				setTimeout(() => { fetch() }, 1000 * 5)
				return
			}

			if (rpt.isEmptyData(res)) {
				sr.contentIsLoading(false)
				return
			}
	
			sr.contentIsLoading(false)
			sr.render(res)
		}, () => {
			sr.contentIsLoading(false)
		})
	}

	sr.contentIsLoading(true)
	fetch()
}

sr.render = (res) => {
	let key = `_id_${toolkit.replace(sr.breakdown(), '.', '_')}`
	let subKey = `_id_customer_reportsubchannel`
	let data = _.orderBy(res.Data.Data, (d) => d[sr.plGrossSales()], 'desc')
	let rowGrossSales  = { name: 'Gross Sales' }
	let rowSalesReturn = { name: 'Sales Return' }
	let rowPercentage  = { name: 'Percentage' }

	let columns = []
	columns.push({
		title: '&nbsp;',
		field: 'name',
		width: 150,
		locked: true,
		attributes: { style: 'font-weight: bold;' }
	}, {
		title: 'Total',
		field: 'total',
		width: 150,
		locked: true,
		attributes: { style: 'font-weight: bold;', class: 'align-right' },
		headerAttributes: { style: 'text-align: center !important; font-weight: bold;' },
		template: (d) => {
			if (d.name == 'Percentage') {
				return `${kendo.toString(d['total'], 'n2')} %`
			}

			return kendo.toString(d['total'], 'n0')
		}
	})

	if (sr.breakdownChannels().length == 0) {
		rowGrossSales['total'] = 0
		rowSalesReturn['total'] = 0
		rowPercentage['total'] = 0

		data.forEach((d) => {
			let holder = toolkit.replace(d._id[key].toLowerCase(), ['.', '/', "'", '"', "\\", "-"], '_')

			rowGrossSales[holder] = d[sr.plGrossSales()]
			rowSalesReturn[holder] = d[sr.plSalesReturn()]
			rowPercentage[holder] = Math.abs(toolkit.number(d[sr.plSalesReturn()] / d[sr.plGrossSales()]) * 100)

			rowGrossSales['total'] += rowGrossSales[holder]
			rowSalesReturn['total'] += rowSalesReturn[holder]
			rowPercentage['total'] = Math.abs(toolkit.number(rowSalesReturn['total'] / rowGrossSales['total']) * 100)

			let column = {}
			columns.push(column)
			column.title = d._id[key]
			column.field = holder
			column.width = 170
			column.attributes = { class: 'align-right' }
			column.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' } 
			column.template = (d) => {
				if (d.name == 'Percentage') {
					return `${kendo.toString(d[holder], 'n2')} %`
				}

				return kendo.toString(d[holder], 'n0')
			}
		})
	} else {
		rowGrossSales['total'] = 0
		rowSalesReturn['total'] = 0
		rowPercentage['total'] = 0

		let op1 = _.groupBy(data, (d) => d._id[`_id_${toolkit.replace(sr.breakdown(), '.', '_')}`])
		let op2 = _.map(op1, (v, k) => ({ key: k, value: v }))
		op2.forEach((f) => {
			let column = {}
			columns.push(column)
			column.title = f.key
			column.columns = []
			column.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' }

			f.value.forEach((d) => {
				let holder = toolkit.replace(d._id[subKey].toLowerCase(), ['.', '/', "'", '"', "\\", "-", ' '], '_')

				rowGrossSales[holder] = d[sr.plGrossSales()]
				rowSalesReturn[holder] = d[sr.plSalesReturn()]
				rowPercentage[holder] = Math.abs(toolkit.number(d[sr.plSalesReturn()] / d[sr.plGrossSales()]) * 100)

				rowGrossSales['total'] += rowGrossSales[holder]
				rowSalesReturn['total'] += rowSalesReturn[holder]
				rowPercentage['total'] = Math.abs(toolkit.number(rowSalesReturn['total'] / rowGrossSales['total']) * 100)

				let subColumn = {}
				column.columns.push(subColumn)
				subColumn.title = d._id[subKey]
				subColumn.width = 170
				subColumn.attributes = { class: 'align-right' }
				subColumn.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' } 
				subColumn.template = (d) => {
					if (d.name == 'Percentage') {
						return `${kendo.toString(d[holder], 'n2')} %`
					}

					return kendo.toString(d[holder], 'n0')
				}
			})

			let totalHolder = `total_${toolkit.replace(f.key.toLowerCase(), ['.', '/', "'", '"', "\\", "-", ' '], '_')}`

			rowGrossSales[totalHolder] = toolkit.sum(f.value, (d) => d[sr.plGrossSales()])
			rowSalesReturn[totalHolder] = toolkit.sum(f.value, (d) => d[sr.plSalesReturn()])
			rowPercentage[totalHolder] = Math.abs(toolkit.number(rowSalesReturn[totalHolder] / rowGrossSales[totalHolder]) * 100)

			let subColumnTotal = {}
			column.columns = [subColumnTotal].concat(column.columns)
			column.order = rowGrossSales[totalHolder]
			subColumnTotal.title = 'Total'
			subColumnTotal.field = totalHolder
			subColumnTotal.width = 170
			subColumnTotal.attributes = { class: 'align-right' }
			subColumnTotal.headerAttributes = { style: 'text-align: center !important; font-weight: bold;' } 
			subColumnTotal.template = (d) => {
				if (d.name == 'Percentage') {
					return `${kendo.toString(d[totalHolder], 'n2')} %`
				}

				return kendo.toString(d[totalHolder], 'n0')
			}
		})

		columns = _.orderBy(columns, (d) => d.order, 'desc')
	}


	let dataParsed = [rowGrossSales, rowSalesReturn, rowPercentage]
	console.log("dataParsed", dataParsed)

	let config = {
		dataSource: {
			data: dataParsed
		},
		columns: columns,
		resizable: false,
		sortable: false, 
		pageable: false,
		filterable: false,
		dataBound: () => {
			let sel = '.grid-dashboard .k-grid-content-locked tr, .grid-dashboard .k-grid-content tr'

			$(sel).on('mouseenter', function () {
				let index = $(this).index()
				console.log(this, index)
		        let elh = $(`.grid-dashboard .k-grid-content-locked tr:eq(${index})`).addClass('hover')
		        let elc = $(`.grid-dashboard .k-grid-content tr:eq(${index})`).addClass('hover')
			})
			$(sel).on('mouseleave', function () {
				$('.grid-dashboard tr.hover').removeClass('hover')
			})
		}
	}


	$('.grid').replaceWith('<div class="grid"></div>')
	$('.grid').kendoGrid(config)
}


vm.currentMenu('Analysis')
vm.currentTitle('&nbsp;')
vm.breadcrumb([
	{ title: 'Godrej', href: viewModel.appName + 'page/landing' },
	{ title: 'Home', href: viewModel.appName + 'page/landing' },
	{ title: 'Sales Return Analysis', href: '#' }
])


$(() => {
	rpt.tabbedContent()

	sr.refresh()
})