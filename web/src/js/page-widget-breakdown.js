viewModel.breakdown = new Object()
let bkd = viewModel.breakdown

bkd.data = ko.observableArray([])
bkd.getParam = () => ra.wrapParam('analysis_ideas')
bkd.refresh = () => {
	// bkd.data(DATATEMP_BREAKDOWN)
	app.ajaxPost("/report/summarycalculatedatapivot", bkd.getParam(), (res) => {
		bkd.data(res.Data)
		bkd.render()
	})
}
bkd.render = () => {
    let config = {
	    filterable: false,
	    reorderable: false,
	    dataSource: {
	        data: bkd.data(),
	        schema: {
	            model: {
	                fields: {
	                    _id: { type: "string" },
	                    plheader1: { type: "string" },
	                    plheader2: { type: "string" },
	                    // plheader3: { type: "string" },
	                    value: { type: "number" }
	                }
	            },
	            cube: {
	                dimensions: {
	                    _id: { type: "string" },
	                    plheader1: { caption: "Group 1" },
	                    plheader2: { caption: "Group 2" },
	                    // plheader3: { caption: "Group 3" }
	                },
	                measures: {
	                    Amount: {
	                        field: "value",
	                        aggregate: "sum",
	                        format: "{0:n2}"
	                    }
	                }
	            }
	        },
	        rows: [
	        	{ name: "plheader1", expand: true },
	            { name: "plheader2" },
	            // { name: "plheader3" }
	        ],
	        measures: ["Amount"]
	    }
	}

	app.log('breakdown', app.clone(config))
	$('.breakdown-view').replaceWith(`<div class="breakdown-view ez"></div>`)
	$('.breakdown-view').kendoPivotGrid(config)
}

$(() => {
	bkd.refresh()
})
