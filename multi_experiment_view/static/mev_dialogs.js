class MEVGroupChooser{
	constructor(proj,div_id){
		this.project_id=proj.id;
		this.project_name = proj.name;
		this.dialog_panel=$("#"+div_id);
		this.dialog_panel.append("<h4>Choose Psuedo Bulk</h6>");
		let self =this;
		this.column_div=$("<ul>").attr("class","list-group list-group-horizontal").appendTo(this.dialog_panel);
		this.executeProjectAction("get_all_groups",{}).then(function(resp){
			self.showGroups(resp.data);
		
		});
		
		
			
	}
		
	showGroups(data){
		let self =this;
		for (let item of data){
			let lgi= $("<li>").attr("class","list-group-item dv-hover").css("width","300px")
			.click(function(e){
				self.setGroup($(this).data("exp"));
				$(".dv-hover").css("background-color","white");
				$(this).css("background-color","lightgray");
			})
			.data("exp",item)
			.appendTo(this.column_div);
			let o = lgi;
			$("<h5>").text(item.name).appendTo(o);
			$("<div>").text("clusters:"+item["cluster_number"]).appendTo(o);
			$("<h6>").text("Experiments").appendTo(o);
			for (let exp of item["experiments"]){
				o.append(exp["name"]+"<br>")
			}
			$("<h6>").text("Description").appendTo(o);
			$("<p>").text(item.description).appendTo(lgi);
		}
			
	}
	
	setGroup(exp){
		this.executeProjectAction("set_group",{group_id:exp.id}).then(function(e){
			location.reload();
		})
	}
	executeProjectAction(action,args){
			if (!args){
				args={}
			}
			
			let data={
				method:action,
				args:args	
			}
		
			return fetch("/meths/execute_project_action/"+this.project_id,
			{
				method:"POST",
				body:JSON.stringify(data),
				headers:{
					"Accept":"application/json,text/plain,*/*",
					"Content-Type":"application/json"
				}
				
			}).then(resp=>resp.json());
	}
	
	
	
}

class MEVViewer{
	constructor(proj,div_id){
		this.project_id=proj.id;
		this.project_name=proj.name;
		this.permission=proj.permission;
		this.setUpDom(div_id);
		
	}
	
	setUpDom(div_id){
		let od =$("#"+div_id).addClass("split-container")
		$("<div>")
		.attr({
			"class":"split split-horizontal",
			id:"filter-panel"
		}).appendTo(od);
		$("<div>").attr({
			"class":"grid split split-horizontal",
			id:"mlv-table"
		}).css({"padding":"5px",overflow:"auto"}).appendTo(od);
		Split(['#filter-panel', '#mlv-table'], {
    		sizes: [70,30],
    		direction:"horizontal",
    		gutterSize:5,
    		onDragEnd:function(){$(window).trigger("resize")}
		});
		
	}
	
	addSaveShareMenuItems(menu){
		let self = this;
		this.addMenuItem(menu,"fas fa-save","Save Current View",function(e){
				self.saveState();
			},{float:"right"});
		this.addMenuItem(menu,"fas fa-share","Share View",function(e){
				new ShareObjectDialog(self.project_id,self.project_name);	
			},{float:"right"});
		this.addMenuItem(menu,"fas fa-globe","Make View Public",function(e){
				makeObjectPublic(self.project_id,self.project_name);			
			},{float:"right"});
				
		
	}
	
	addMenuItem(menu,icon,tooltip,func,css){
		let i = $("<i>").attr("class",icon+" mev-icon")
		.attr({title:tooltip,"data-toggle":"tooltip"})
		.click(function(e){
			func();
		});
		if (css){
			i.css(css);
		}
		
		i.appendTo(menu);
	}
	
	
	executeProjectAction(action,args){
		if (!args){
			args={}
		}
		
		let data={
			method:action,
			args:args	
		}
	
		return fetch("/meths/execute_project_action/"+this.project_id,
		{
			method:"POST",
			body:JSON.stringify(data),
			headers:{
				"Accept":"application/json,text/plain,*/*",
				"Content-Type":"application/json"
			}
			
		}).then(resp=>resp.json());
	}
}

class MEVGroupViewer extends MEVViewer{
	constructor(proj,div_id){
		super(proj,div_id);
	
		this.genes=[];
		this.cluster_columns=[];
		this.selected_genes={};
		let self=this;
		this.chosen_genes={};
		this.extra_data={};
		this.scatter_plots={};
		
		this.group_colors=[
			["HV","#0072B2"],["CH","#F0E442"],["CM","#009E73"],
			["CS","#56B4E9"],["CC","#E69F00"],["Se","#CC79A7"],["LFC","#D55E00"],["LCC","#000000"]
		];
		
		
		let data = proj.data
		this.clusters=data.clusters;
		this.experiments=data.experiments;
		this.exp_index={};
		this.current_view=data.current_view;
		this.selected_type="residuals";
		this.samples=data.samples;
		this.filter_panel= new FilterPanel("filter-panel",this.samples);
		this.sample_metadata={};
		
		this.current_sample_metadata="source"
		this.dialog_panel= $("#mlv-table");
		this.sample_groups= data.sample_groups;
		
		this.sample_filter_select = $("<select>").append($("<option>").text("All").val("All"));
	
		
		let mp=$("<div>").appendTo(this.dialog_panel);
		mp.append($("<span>").css({"font-size":"18px","font-weight":"bold"}).text(data.group_name));
		
		for (let gr in this.sample_groups){
			this.sample_filter_select.append($("<option>").text(gr).val(gr));
		}
		this.dialog_panel.append($("<span>").text("Sample Set:").css({"font-weight":"bold"}))
		this.sample_filter_select.val("All").change(function(e){
			self.filterSampleGroup($(this).val())
			
		}).appendTo(this.dialog_panel);
		this.dialog_panel.append($("<span>").text("Sample Field:").css({"font-weight":"bold"}))
		this.sample_data_select = $("<select>");
		for (let sc of data.sample_fields){
			this.sample_metadata[sc.id]=sc;
			this.sample_data_select.append($("<option>").val(sc.id).text(sc.name));
			
		}
		this.sample_data_select.appendTo(this.dialog_panel).change(function(e){
			self.changeSampleMetadata($(this).val())
		})
	
		if (proj.permission==="edit"){
			this.addSaveShareMenuItems(mp);
		}
		
		
		this.addMenuItem(mp,"fas fa-project-diagram","Add Scatter Plot",function(){
			self.showScatterPlotDialog();
		});
		$('[data-toggle="tooltip"]').tooltip();
		
		
	
		this.dialog_panel.append("<h6>Cluster</h6>");
		this.cluster_panel=$("<div>").appendTo(this.dialog_panel);
	    this.current_view=proj.data.current_view;
	    this.clusters=data.clusters;
		this.experiments=data.experiments;
		this.selected_group=data.group_id;
		this.setUpClusterPanel();
		this.filter_panel.addRemoveListener(function(chart){
			self.chartRemoved(chart);
		});
		if (!this.current_view){
			let x=6;
			let y=0
			for (let sc of data.sample_fields){
				 this.filter_panel.addChart({
				    	type:"row_chart",
				    	param:sc.id,
				    	id:"source-"+sc.id,
				    	title:name,
				    	cap:20,
				    	group_colors:{
				    		source:this.group_colors
				    	},
				    	location:{
				    		x:x,
				    		y:y,
				    		width:3,
				    		height:3
				    		
				    	}
				    });
				 x+=3;
				 if(x===12){
					 x=6;
					 y+=3;
				 }
			}
		}
		
	   
		

	}
	
	chartRemoved(chart){
		if (chart.id.startsWith("cluster-hm")){
			//let exp_id= chart.id.split("-")[2];
			//this.removeAllGenes(exp_id);
		}
		else{
			delete this.scatter_plots[chart.id];
		}
	}
	
	changeSampleMetadata(value){
		let info = this.sample_metadata[value];
		this.current_sample_metadata=value;
		for (let id in this.filter_panel["charts"]){
			let ch = this.filter_panel["charts"][id];
			if (id.startsWith("cluster-hm") || id.startsWith("gene-hm")){
				this.filter_panel.charts[id].groupBy(value);
			}
			else if (ch.type==="wgl_scatter_plot"){
				
				ch.config.color_by={
					column:{
						datatype:"text",
						field:info.field,
						name:info.name
					},
					display_legend:false
				};
				ch.setColorFromConfig();
			}
		}	
	}
	filterSampleGroup(value){
		this.sample_filter_group=value;
		if (value==="All"){
			this.filter_panel.removeCustomFilter("sample_group")
		}
		else{
			let li = this.sample_groups[value];
			this.filter_panel.addCustomFilter("sample_group","id",function(d){
				return li.indexOf(d)!==-1;
			})
		}
	}
	
	
	
	getGroupInfo(id){
		let self = this
		this.selected_group=id;
		this.executeProjectAction("get_group_info",{gid:id}).then(function(resp){
			self.clusters=resp.data.clusters;
			self.experiments=resp.data.experiments;
			self.setUpClusterPanel();
		})
	}
	
	getIndividualGeneData(e){
		
		let type = $("#sel-datatype-exp-"+e.id).val();
		let self = this;
		let gene_id=this.selected_genes[e.id][0];
		let gene_name=this.selected_genes[e.id][1];
		let args={
				gene_id:gene_id,
				group:this.selected_group,
				type:type
		}
		this.executeProjectAction("get_individual_gene_data",args).then(function(resp){
			self.addIndividualGeneData(resp.data);
			let chart = self.filter_panel.charts["gene-hm-"+e.id];
			let title= gene_name+ " "+e.name+" "+type;
			if (chart){
				chart.setTitle(title);
				chart.refreshColors();
			}
			else{
				self.addIndividualGeneChart(e,type,title);
			}
			
		});
		
	}
	
	addIndividualGeneChart(exp,type,title){
		let cs= null;
		let id= "gene-hm-"+exp.id;
		for (let dt of exp.main_data.datatypes){
			if (dt.col_name===type){
				cs = dt.scale;
				break;
			}
		}
		let param=[];
		for (let c in this.clusters){
			param.push("c"+c+"_"+exp.id);
		}
		let graph_config={
				type:"heat_map",
				group_by:this.current_sample_metadata,
				id:id,
				location:{x:6,y:0,width:6,height:8},
				universal_color_scale:cs,
				title:title,
				tooltip:{x_name:"sample",x_field:"name",y_name:"cluster"},
				param:param
			}
		if (this.current_view){
			let saved_graph=false;
		
				let index=0;
				for (;index<this.current_view.charts.length;index++){
					let g= this.current_view.charts[index];
					if (g.id==id){
						graph_config=g;
						saved_graph=true;
						break;
					}
				}
				if (saved_graph){
					this.current_view.charts.splice(index,1);
				}
			
		}
		graph_config.group_colors={
			source:this.group_colors
		};
		
		this.filter_panel.addChart(graph_config);
	}
	
	getGeneDropDown(genes){
		let sel =$("<select>");
		for (let g in genes){
			let og = $("<optgroup>").attr("label",g).appendTo(sel);
			let cols = genes[g];
			for (let col of cols){
				$("<option>").val(col.field).text(col.name+"("+g+")").appendTo(og);
			}
				
		}
		return sel;
		
	}
	addScatterPlot(ids,title){
		let id = ids[0]+"_"+ids[1];
		this.scatter_plots[id]={
				ids:ids
		};
		let info = this.sample_metadata[this.sample_data_select.val()];
		this.filter_panel.addChart({
			param:[ids[0],ids[1]],
			axis:{
				x_label:this.genes[ids[0]].columnGroup+" "+this.genes[ids[0]].name,
				y_label:this.genes[ids[1]].columnGroup+" "+this.genes[ids[1]].name
			},
			type:"wgl_scatter_plot",
			title:title,
			id:id,
			group_colors:{
				source:this.group_colors
			},
			color_by:{
				column:{
					datatype:"text",
					field:info.field,
					name:info.name
				}
			}
		
			
		});
	}
	
	showScatterPlotDialog(){
		let groups={};
		let self =this;
		for (let e of this.experiments){
			groups[e.name]=[];
		}
		
		for (let fid in this.genes){
			let col = this.genes[fid];
			if (groups[col.columnGroup]){
				groups[col.columnGroup].push(col)
			}
		}
		for (let n in groups){
			groups[n].sort(function(a,b){
				return a.name.localeCompare(b.name);
			})
		}
		let x_sel = this.getGeneDropDown(groups);
		let y_sel= this.getGeneDropDown(groups);
		let ti = $("<input>").val("Scatter Plot");
		$("<div>").attr("class","dv-dialog")
		.append("<label>X Value:</label>").append(x_sel)
		.append("<label>Y Value:</label>").append(y_sel)
		.append("<label>Title:</label>").append(ti)
		.dialog({
			close:function(){
				$(this).dialog("destroy").remove();
			},
			title:"Add Scatter Plot",
			buttons:[{
				text:"Add Plot",
				click:function(e){
					self.addScatterPlot([x_sel.val(),y_sel.val()],ti.val())
					$(this).dialog("close");
					
				}
			}]
			
		}).dialogFix();
		
	}
	
	
	getGeneData(e,replace_graph){
		let gids=[];
		let self =this;
		let first=true;
		$("#gene-panel-"+e.id).find(".mev-chosen-gene").each(function(i,el){
			let id = $(el).data("gid");
			gids.push(id);
			if (first){
				self.selected_genes[e.id]=[id,$(el).data("gene_name")];
				
				first=false;
				
			}
		});
		if (this.current_view){
			let sg =self.current_view.experiments[e.id].selected_gene;
			if (sg){
				this.selected_genes[e.id]=sg;
				delete this.current_view.experiments[e.id].selected_gene
			}
		}
		let cluster=e.bulk?1:this.selected_cluster;
		let type = $("#sel-datatype-exp-"+e.id).val();
		let args={
				experiment:e.id,
				type:type,
				group:this.selected_group,
				gene_ids:gids,
				cluster:cluster
				
				
		}
		this.executeProjectAction("get_gene_data",args).then(function(resp){
			self.addGeneData(resp.data,cluster);
			if (replace_graph){
				self.replaceGeneGraph(e,gids,type);
			}
			else{
				let graph = self.filter_panel.charts["cluster-hm-"+e.id];
				graph.setTitle(e.name+" "+type+" "+self.clusters[cluster].name)
				graph.refreshColors();
				for (let id in self.scatter_plots){
					self.filter_panel.charts[id].refreshPositions();
				}
			}
			
		});
		
	}
	
	replaceGeneGraph(exp,gene_ids,type){
		let graph_id = "cluster-hm-"+exp.id;
		let graph = this.filter_panel.charts[graph_id];
		let cs= null;
		let title=null;
		let graph_config=null;
		//work out title
		for (let dt of exp.main_data.datatypes){
			if (dt.col_name===type){
				cs = dt.scale;
				title= exp.name+" "+dt.name;
				if (!exp.bulk){
					title+=" "+this.clusters[this.selected_cluster].name;
				}
			}
		}
		let saved_graph=false;
		if (this.current_view){
			let index=0;
			for (;index<this.current_view.charts.length;index++){
				let g= this.current_view.charts[index];
				if (g.id==graph_id){
					graph_config=g;
					saved_graph=true;
					this.exp_gene_graphs--;
					break;
				}
			}
			if (this.exp_gene_graphs===0 && this.initial_load){
				this.displayOtherGraphs();
			}
			if (saved_graph){
				this.current_view.charts.splice(index,1);
				if (this.current_view.charts.length===0){
					
				}
			}
		}
		
		if (!saved_graph){
			if (!graph){
				graph_config={
					type:"heat_map",
					group_by:this.current_sample_metadata,
					id:"cluster-hm-"+exp.id,
					location:{x:0,y:0,width:6,height:8},
					tooltip:{x_name:"sample",x_field:"name",y_name:"gene"},					
				}
				
				
			}
			else{
				graph_config=graph.getConfig(graph_id);
				graph_config.type="heat_map";
				graph_config.location=this.filter_panel.getChartLocation(graph_config.id);
				this.filter_panel.removeChart(graph_id)
						
				
			}
			graph_config.title=title
			graph_config.universal_color_scale=cs;
			graph_config.param=gene_ids;
			
			
		}
		graph_config.group_colors={
			source:this.group_colors
		}
		//update colums
		let cols=[];
		for (let id in this.genes){
			cols.push(this.genes[id]);
			
		}
		//remove any scatter_plots
		let scps_to_remove=[];
		for (let id in this.scatter_plots){
			let scp = this.scatter_plots[id];
			if (!(this.genes[scp.ids[0]])|| !(this.genes[scp.ids[0]])){
				scps_to_remove.push(id);
			}
		}
		for (let rm of scps_to_remove){
			delete this.scatter_plots[rm];
			this.filter_panel.removeChart(rm);
		}
		graph_config.tooltip={x_name:"sample",x_field:"id",y_name:"gene"}
		
		this.filter_panel.setColumns(this.cluster_columns.concat(cols));
		this.filter_panel.addChart(graph_config);
		//also need to replace individual gene_graph
		if (!exp.bulk){
			this.getIndividualGeneData(exp)
		}

		
	}
	
	displayOtherGraphs(){
		let ch_index = {};
		for (let chart of this.current_view.charts){
			ch_index[chart.id]=chart;
			if (chart.id.startsWith("source")){
				this.filter_panel.addChart(chart);
			}
		}
		for (let id in this.scatter_plots){
			this.filter_panel.addChart(ch_index[id]);
		}
		for (let id in this.extra_data){
			let info= this.extra_data[id];
			$("#"+id).prop("checked",true);
			this.addUpdateGraph(info.exp_id,info.data,"add",ch_index[id]);
		}
		let v = this.current_view.sample_filter_group;
		if (v){
			this.sample_filter_select.val(v);
			this.filterSampleGroup(v);
		}
		this.initial_load=false;
	}
	
	
	
	addGeneData(data,cluster){
		let cf = "c"+cluster
		for (let sample of this.samples){
			let sid= sample["id"]
			for (let v of data){
				let val = v[cf][sid-1];
				if (val!=null){
					sample[v["field_id"]]=val;
				}	}
		}
		
	}
	addIndividualGeneData(data){
		for (let cid in this.clusters){
			
		}
		for (let sample of this.samples){
			let sid=sample["id"];
			for (let c in this.clusters){
				let cid = "c"+c
				let val=data[cid][sid-1];
				if (val!==null){
					sample[cid+"_"+data.exp_id]=val;
				}
			}
			
		}
	}
	
	saveState(){
		let data={experiments:{}};
		let self = this;
		for (let e of this.experiments){
			 let item = {genes:[]}
			 let sel_gene_id=null;
			 if (this.selected_genes[e.id]){
				 sel_gene_id=this.selected_genes[e.id][0];
			 }
			 $("#gene-panel-"+e.id).find(".mev-chosen-gene").each(function(i,el){
				 let id = $(el).data("gid");
				 let name= $(el).data("gene_name");
				 item.genes.push([id,name]);
				 
				 if (id==sel_gene_id){
					 item.selected_gene=self.selected_genes[e.id];
				 }
				 
			 })
			
			 item.type = $("#sel-datatype-exp-"+e.id).val();
			 data.experiments[e.id]=item;
		}
		data.selected_cluster=this.selected_cluster;;
		data.charts = this.filter_panel.getGraphs();
		data.selected_group=this.selected_group;
		data.scatter_plots= this.scatter_plots;
		data.extra_data=this.extra_data;
		data.sample_filter_group= this.sample_filter_group?this.sample_filter_group:"All";
		data.sample_metadata= this.sample_data_select.val();
		
		
		this.executeProjectAction("save_view",{data:data}).then(function(response){
				if (response.success){
					new MLVDialog("The view has been saved",{type:"success"});
				}
				else{
					new MLVDialog(response.msg,{type:"danger"});
				}			
			});	
	}
	
	setState(){
		let data= this.current_view;
		for (let eid in data.experiments){
			let exp=data.experiments[eid];
			let div =$("#gene-panel-"+eid);
			for (let info of exp.genes){
				this.addChosenGene(info[1],info[0],eid);
			}
			$("#sel-datatype-exp-"+eid).val(exp.type);
			$("#mev-group-submit-"+eid).attr("disabled",true)
			
		}
		this.clusterSelected(data.selected_cluster);
		this.exp_gene_graphs=0;
		this.scatter_plots=data.scatter_plots?data.scatter_plots:{};
		this.extra_data=data.extra_data?data.extra_data:{};
		for (let eid in data.experiments){
			if (data.experiments[eid].genes.length>0){
				this.exp_gene_graphs++;
			}
			
		}
		this.initial_load=true;
		if (data.sample_metadata){
			this.sample_data_select.val(data.sample_metadata);
			
		}
		
		for (let eid in data.experiments){
			if (data.experiments[eid].genes.length>0){
				this.getGeneData(this.exp_index[eid],true);
			}
		}
		
		
	}
	
	
	
	getGeneInfo(gene_list,exp_id){
		let args = {
				exp_id:exp_id,
				gene_list:gene_list
				
		};
		let self =this;
		this.executeProjectAction("get_gene_info",args).then(function(data){
				for (let gene of data.data){
					self.addChosenGene(gene.name,gene.id,exp_id,exp_id);
				}
		});
	}
	
	showGeneListInput(exp_id){
		let ta= $("<textarea>").css("width","100%");
		let self =this;
		$("<div>").append(ta).dialog({
			close:function(){
				$(this).dialog("destroy").remove();
			},
			title:"Paste Gene List",
			buttons:[{
				text:"submit",
				click:function(e){
					self.getGeneInfo(ta.val().split(/(\s+)/).filter(Boolean),exp_id);
					$(this).dialog("close");
					
				}
			}]
			
		}).dialogFix();
		
	}
	
	
	clusterSelected(id){
		this.selected_cluster=id;
		let self =this;
		//do we have any graphs need updating
		
		for (let exp of this.experiments){
			if (exp.bulk){
				continue;
			}
			let id= "cluster-hm-"+exp.id;
			if (this.filter_panel.charts[id]){
				this.getGeneData(exp,false);
			}
		}
		for (let id in this.extra_data){
			let d= this.extra_data[id];
			this.addUpdateGraph(d.exp_id,d.data);
		}
		
		
		
		
	}
	

	
	setUpClusterPanel(){
		for (let e of this.experiments){
			for (let c in this.clusters){
				this.cluster_columns.push({
					datatype:"double",
					name:this.clusters[c].name,
					field:"c"+c+"_"+e.id,
					columnGroup:"cluster_"+e.id
				})
			}
		}
		let self = this;
		let first=true;
		for (let cid in this.clusters ){
			let cluster=this.clusters[cid];
			let d  = $("<span>").text(cluster.name).data("id",cid)
			.attr("class","mev-cluster-span dv-hover")
			this.cluster_panel.append(d);
			if (first && !self.current_view){
				d.css("background-color","lightgray");
				this.selected_cluster=cid;
				first=false;
			}
			if (self.current_view && self.current_view.selected_cluster==cid){
				d.css("background-color","lightgray");
				this.selected_cluster=cid;
			}
			
		}
		$(".mev-cluster-span").click(function(e){
			self.clusterSelected($(this).data("id"));
			$(".mev-cluster-span").css("background-color","white");
			$(this).css("background-color","lightgray");
		})
		
		this.exp_index={};
		
		for (let experiment of this.experiments){
			this.addExperimentPanel(experiment);
			this.exp_index[experiment.id]=experiment;
			
		}
		if (this.current_view){
			this.setState();
		}
	
		
	}
	
	removeExtraGraph(exp_id,data){
		let id = exp_id+"_"+data.col_name;
		delete this.extra_data[id];
		this.filter_panel.removeChart(id);
		
	}
	
	addUpdateGraph(exp_id,data,action,graph){
		let gene_ids=[];
		let columns=[];
		let param=[];
		let id = exp_id+"_"+data.col_name;
		for (let p of data.param){
			gene_ids.push(p.id);
			param.push(exp_id+"_"+p.id);
			columns.push({
				name:p.name,
				field:exp_id+"_"+p.id,
				columnGroup:data.name,
				sortable:true,
				filterable:true
			})
		};
		
		this.extra_data[id]={
				exp_id:exp_id,
				data:data
		};
		let self = this;
		let args={
			cluster:this.selected_cluster,
			group:this.selected_group,
			type:data.col_name,
			gene_ids:gene_ids
				
		};
		let chart_data=graph;
		let info = this.sample_metadata[this.sample_data_select.val()];
		if (!chart_data){
			chart_data={
				type:data.type,
				title:data.name,
				param:param,
				id:id,
				color_by:{
					column:{
						datatype:"text",
						field:info.field,
						name:info.name
					}
				},
				group_colors:{
					source:this.group_colors
				}
						
					
			};
		}
		this.executeProjectAction("get_gene_data",args).then(function(resp){
			let data = resp.data;
			let cf = "c"+self.selected_cluster;
			for (let sample of self.samples){
				let sid= sample["id"]
				for (let v of data){
					let val = v[cf][sid-1];
					if (val!=null){
						sample[exp_id+"_"+v["field_id"]]=val;
					}	}
			}
			if (action==="add"){
				self.filter_panel.addChart(chart_data);
			}
			else{
				self.filter_panel.charts[id].refreshPositions();
			}
			
			
		})
		
	}
	
	
	
	addExperimentPanel(experiment){
		let self = this;
		let op=$("<div>").appendTo(this.dialog_panel);
		let exp_title_div=$("<div>").appendTo(op).data("state","closed")
		.css({"max-width":"200px","background-color":"#17a2b8","cursor":"pointer","margin-bottom":"2px","margin-top":"2px"});
		$("<h6>"+experiment.name+"</h6>").css("display","inline-block").appendTo(exp_title_div);
		$("<i class='fas fa-caret-right'>").appendTo(exp_title_div).css({"font-size":"20px","margin-right":"3px","float":"right"});
		let gp = $("<div>").css("display","none").appendTo(op);
		exp_title_div.click(function(e){
			let th= $(this);
			if (th.data("state")==="closed"){
				gp.show();
				let i = th.find("i");
				i.removeClass("fa-caret-right").addClass("fa-caret-down");
				th.data("state","open")
			}
			else{
				gp.hide();
				let i = th.find("i");
				i.removeClass("fa-caret-down").addClass("fa-caret-right");
				th.data("state","closed");
			}
		})
		
		
		
		gp.append($("<span>").text(experiment.main_data.name+":").css({"font-weight":"bold","margin-right":"2px"}));
		let sel = $("<select>").attr("id","sel-datatype-exp-"+experiment.id);
		for (let dt of experiment.main_data.datatypes){
			sel.append($("<option>").text(dt.name).val(dt.col_name))
		}
		gp.append(sel);
		gp.append("<br>");
		let i =$("<input>").data("exp_id",experiment.id).appendTo(gp);
	 
		this.setUpAutocomplete(i,experiment.id,gp);
		this.exp_index[experiment.id]=experiment;
		i =$("<i>").attr("class","fas fa-list mev-icon")
			.data("exp_id",experiment.id)
			.click(function(e){
				self.showGeneListInput($(this).data("exp_id"));
			}).appendTo(gp);
	
		let d = $("<div>").attr("id","gene-panel-"+experiment.id).appendTo(gp);
		d.click(function(e){
			let i = $(e.target);
			let gid=i.data("gene_id");
			let type = i.data("type");
			let gene_name = i.data("gene_name")
			if (gid){
				if (type==="view"){
					self.selected_genes[experiment.id]=[gid,gene_name];
					self.getIndividualGeneData(experiment)
				}
				else if (type==="remove"){
					i.parent().remove();
					delete self.genes[gid];
					delete self.chosen_genes[gid];
					if (Object.keys(self.chosen_genes).length===0){
						$("#mev-group-submit-"+experiment.id).attr("disabled",true);
						$("#mev-group-remove-"+experiment.id).attr("disabled",true);
					}
					else{
						$("#mev-group-submit-"+experiment.id).attr("disabled",false);
					}
					
				}
			}
		});
		
		
		$("<button>").attr({"class":"btn btn-primary btn-sm mev-btn-sm",id:"mev-group-submit-"+experiment.id,disabled:true})
		.text("update")
		.click(function(e){
			self.getGeneData(experiment,true);
			$(this).attr("disabled",true)
		}).appendTo(gp);
		
		$("<button>").attr({"class":"btn btn-secondary btn-sm mev-btn-sm",id:"mev-group-remove-"+experiment.id,disabled:true})		
		.text("Remove All")	
		.click(function(e){
			self.removeAllGenes(experiment.id)
			
		}).appendTo(gp);
		
		
		let od_panel=$("<div>").appendTo(gp);
		for (let od of experiment.other_data){
			od_panel.append(od.name);
			$("<input>").data("exp",od).appendTo(od_panel)
			.attr({type:"checkbox",id:experiment.id+"_"+od.col_name}).click(function(e){
				if ($(this).prop("checked")){
					self.addUpdateGraph(experiment.id,$(this).data("exp"),"add");
				}
				else{
					self.removeExtraGraph(experiment.id,$(this).data("exp"));
				}
			})
			
		}
		
		
		
	}
	
	removeAllGenes(exp_id){
		let d= $("#gene-panel-"+exp_id);
		let self =this;
		d.find(".mev-chosen-gene").each(function(i,e){
			let id = $(e).data("gid");
			delete self.genes[id];
			delete self.chosen_genes[id];
		});
		d.find(".mev-chosen-gene").remove();
		$("#mev-group-submit-"+exp_id).attr("disabled",true);
		$("#mev-group-remove-"+exp_id).attr("disabled",true);
		
	}
	
	
	
	setUpAutocomplete(input,exp_id){
		let self =this;
		input.css({"padding":"2px","margin-top":"2px","margin-bottom":"2px"}).autocomplete({
				minLength:2,
				source:function(request,response){
					
					self.executeProjectAction("get_gene_suggest",{term:request.term,eid:exp_id}).then(function(data){
						response(data.data);
					})
				},
				select:function(e,ui){
					self.addChosenGene(ui.item.label,ui.item.value,exp_id);
					input.val("");
					return false;
				}
			})
	}
	
	addChosenGene(label,id,exp_id){
		if (this.chosen_genes[id]){
			return;
		}
		this.genes[id]={
			field:id,
			name:label,
			datatype:"double",
			columnGroup:this.exp_index[exp_id].name
				
		}
		this.chosen_genes[id]=exp_id;
		let d =$("<div>").data({"gid":id,"gene_name":label}).attr("class","mev-chosen-gene").css({"font-size":"13px"});
		d.append($("<span>").text(label).css({"width":"100px","display":"inline-block"}));
		if (!this.exp_index[exp_id].bulk){
			d.append($("<i class='fas fa-eye'></i>").css("margin-left","5px").data({
				gene_id:id,gene_name:label,type:"view"
			}));
		}
	
		d.append($("<i class='fas fa-trash'></i>").css("margin-left","5px").data({
			gene_id:id,type:"remove"
		}));
		d.appendTo("#gene-panel-"+exp_id);
		$("#mev-group-submit-"+exp_id).attr("disabled",false);
		$("#mev-group-remove-"+exp_id).attr("disabled",false);
	}
	
}


class MEVGeneChooser{
	constructor(div,project_id,exp_id,callback){
		this.project_id=project_id;
		this.exp_id=exp_id;
		this.callback=callback;
		let input = $("<input>").appendTo(div);
		this.setUpAutocomplete(input,exp_id);
		let self =this;
		$("<i>").attr("class","fas fa-list mev-icon")
			.click(function(e){
				self.showGeneListInput();
			}).appendTo(div);
	}
	
	showGeneListInput(){
		let ta= $("<textarea>").css("width","100%");
		let self =this;
		$("<div>").append(ta).dialog({
			close:function(){
				$(this).dialog("destroy").remove();
			},
			title:"Paste Gene List",
			buttons:[{
				text:"submit",
				click:function(e){
					self.getGeneInfo(ta.val().split(/(\s+)/).filter(Boolean));
					$(this).dialog("close");
					
				}
			}]
			
		}).dialogFix();
	}
	
	getGeneInfo(gene_list){
		let args = {
			exp_id:this.exp_id,
			gene_list:gene_list	
		};
		let self =this;
		this.executeProjectAction("get_gene_info",args).then(function(resp){
			self.callback({data:resp.data,exp_id:sel.exp_id});				
		});
	}	
	
	
	setUpAutocomplete(input,exp_id,div){
		let self =this;
		input.autocomplete({
			minLength:2,
			source:function(request,response){
				self.executeProjectAction("get_gene_suggest",{term:request.term,eid:exp_id}).then(function(data){
					response(data.data);
				})
			},
			select:function(e,ui){
				let data=[{
					name:ui.item.label,
					id:ui.item.value
					
				}];
				self.callback({data:data,exp_id:self.exp_id});
				return false;
			}
		});
	}
	
	executeProjectAction(action,args){
		if (!args){
			args={}
		}	
		let data={
			method:action,
			args:args	
		}
		return fetch("/meths/execute_project_action/"+this.project_id,
		{
			method:"POST",
			body:JSON.stringify(data),
			headers:{
				"Accept":"application/json,text/plain,*/*",
				"Content-Type":"application/json"
			}
			
		}).then(resp=>resp.json());
	}	
}




class MEVDataViewer extends MEVViewer{
	constructor(data,div_id){
		super(data,div_id);
		this.exp_id=data.data["view_data"]["exp_id"]
		this.column_index={};
		let self =this;
		this.menu_div= $("<div>")
		.css({"height":"30px","overflow":"hidden","white-space":"nowrap"})
		.appendTo("#mlv-table");
		$("<div>").css({height:"calc(100% - 30px)"}).attr("id","the-table-div").appendTo("#mlv-table");
		if (data.permission==="edit"){
			
			this.addSaveShareMenuItems(this.menu_div);
		}
		
	
	
		this.w_dialog= new WaitingDialog("Loading Data");
		this.w_dialog.wait("Loading Data");
		this.executeProjectAction("get_view",{offset:0,limit:25000}).then(function(resp){
			self.init(resp.data)
		})

	
	}
	
	
	addDataToView(data){
		for (let col of data.columns){
    		this.columns.push(col);
    		this.column_index[col.id]=col;
    	}
		if (data.data){
			for (let id in data.data ){
        		let row = this.table.data_view.getItemById(parseInt(id));
        		if (!row){
        			continue;
        		}
        		let item =data.data[id]
        		for (let field in item){
        			row[field]=item[field]
        		}		
        	}
			
		}
		this.table.addColumns(data.columns);
    	this.table.updateGroupPanel();
    	this.filter_panel.setColumns(this.columns);
    	if (data.graphs){
    		for (let graph of data.graphs){
    			this.filter_panel.addChart(graph);   	
    		}
    	}	
	}
	
	
	
	
	addTagColumn(){
		let self = this;
		let d = $("<div>");
		d.append("<label>Tag Column Name:<label><br>")
		let input= $("<input>").appendTo(d);
		d.dialog({
			close:function(){
				$(this).dialog("destroy").remove();
			},
			title:"Add Tagging Column",
			buttons:[{
				text:"Add",
				id:"add-column-submit",
				click:function(e){
					if (d.data("all_done")){
						$(this).dialog("close");
					}
					else{
						let name = input.val();
						if (name){
							self.executeProjectAction("add_tagging_column",{name:name}).then(function(resp){
								if (resp.success){
									self.addDataToView(resp.data);
									let col =resp.data.columns[0];
									self.tag_column_select.append($("<option>").text(col.name).val(col.field))
									d.data("all_done",true)
									d.html("<div class='alert alert-success'>The column has been added. Use the <i class='fas fa-tag'></i> icon to add tags</div>");
								}
								$("#add-column-submit").text("OK")
								
							})
						}
					}
					
				}
			}]
			
		}).dialogFix();
		
	}
	
	init(data){
		let self = this;
		if (!this.temp_data){
			this.temp_data=data
		}
		else{
			this.temp_data.data = this.temp_data.data.concat(data.data)
		}
		
		
		
		let len = this.temp_data.data.length;
		this.w_dialog.setWaitingMessage("Loaded "+len+"/"+this.temp_data.size)
		if ( len=== this.temp_data.size){
			
			
			this.columns=this.temp_data.columns;
			for (let col of this.columns){
				this.column_index[col.id]=col;
			}
			this.filter_panel= new FilterPanel("filter-panel",this.temp_data.data,
				{menu_bar:true,graphs:this.temp_data.graphs,columns:this.temp_data.columns})
			this.data_view=new FilterPanelDataView(this.filter_panel);
			
			for (let col in this.temp_data.tag_data){
				let d= this.temp_data.tag_data[col];
				for (let id in d){
					let item = this.data_view.getItemById(id);
					item[col]=d[id];
				}
			}
			
			this.filter_panel.addListener(function(items,count){
				if (self.browser){
					self.bam_track.setSelected(items,count);
					self.browser.panel.update();
				}
	        
	        });

		
			let td = $("<div>").attr("id","the-table-div-1").css("height","100%").appendTo("#the-table-div");
			if (this.temp_data.static_graphs){
				this.addImageTable(this.temp_data.static_graphs);
			}
		
			this.table= new MLVTable("the-table-div-1",this.temp_data.columns,this.data_view);
		
			this.table.addListener("row_clicked_listener",function(item,column,e){
				self.filter_panel.highlightDataItem(item.id);
			});
			let gc_div=$("<div>").css("display","inline-block").appendTo(this.menu_div);
			this.gene_chooser= new MEVGeneChooser(gc_div,this.project_id,this.exp_id,function(genes){
				self.loadChosenGenes(genes);
			})
			if (this.permission==="edit"){
				
				let p = $("<i>").attr("class","fas fa-plus mev-icon")
				.attr({title:"Add Tag Column","data-toggle":"tooltip"})
				.click(function(e){
					self.addTagColumn();
				});
				this.filter_panel.addMenuIcon(p);
				this.tag_column_select=$("<select>");
				this.tag_column_value=$("<input>").css("width","100px");
				this.filter_panel.addMenuIcon(this.tag_column_select);
				this.filter_panel.addMenuIcon(this.tag_column_value);
				for (let col of this.temp_data.columns){
					if (col.columnGroup==="Tags"){
						this.tag_column_select.append($("<option>").text(col.name).val(col.field));
					}
				}
				let i = $("<i>").attr("class","fas fa-tag mev-icon")
				.attr({title:"Tag selected items","data-toggle":"tooltip"})
				.click(function(e){
					self.tagFilteredItems();
				});
				this.filter_panel.addMenuIcon(i);
			
			}
		    this.w_dialog.remove()
		    this.w_dialog=null;
		    $('[data-toggle="tooltip"]').tooltip();
		    this.temp_data=null;
		}
		
		else{
			let offset = data.data[data.data.length-1]["id"];
			this.executeProjectAction("get_view",{offset:offset,limit:25000}).then(function(resp){
				
				self.init(resp.data)
			})

			
			
		}
	}
	
	loadChosenGenes(genes){
		let gene_ids=[];
		let already=[];
		let self = this;
		for (let gene of genes.data){
			if (this.column_index[gene.id]){
				already.push(gene.name)
			}
			
				gene_ids.push(gene.id)
			
		}
		
		if (gene_ids.length>0){
			this.executeProjectAction("get_gene_data",{gene_ids:gene_ids}).then(function(resp){
				self.addDataToView(resp.data);
			})
		}
	}
	
	addImageTable(data){
		this.table_mode="table";
		let dv = new  MLVDataView(data.data);
		let self=this;
		let itd=$("<div>").attr("id","the-table-div-2")
		.css({height:"100%",display:"none"}).appendTo("#the-table-div");
		let columns= [
				{
					"field":"cluster_field",
					"name":"Cluster"
				},
				{
					"field":"cluster_id",
					"name":"Cluster ID"
				},
				
				{
					"field":"group",
					"name":"Value Type"
				},
				{
					"field":"group_id",
					"name":"Value"
				},			
				{
					"field":"boxes",
					"name":"Boxes"
				}	
			
		];
		for (let col of columns){
			col.datatype="text";
			col.sortable=true,
			col.filterable=true;
		}
		
		this.image_table = new MLVImageTable("the-table-div-2",dv,
			{
			base_url:data.link,
			initial_image_width:200,
			show_info_box:true
			
			
			});
		this.image_table.setColumns(columns);
		let i = $("<i>").attr("class","fas fa-chart-bar mev-icon")
		.attr({title:"Toggle table/static graphs","data-toggle":"tooltip"})
		.click(function(e){
			self.switchTableMode($(this))
		}).prependTo(this.menu_div);
		
		this.image_slider = $("<div>").attr({"id":"mlv-it-image-slider"})
        .css({width:"100px",display:"inline-block"}).slider({
	        max:200,
	        min:0,
	        value:100,
	        stop:function(e,ui){
	             let val =ui.value/100;
	             let width = parseInt(self.image_table.img_width*val);
	             let height= parseInt(self.image_table.img_height*val);
	             self.image_table.setImageDimensions([width,height],true);
	             //self.image_table.show();
	        }
        }).appendTo(this.menu_div).hide();
		
		this.addMenuItem(this.menu_div,"fas fa-filter","Filter Graphs",function(e){
			self.image_table.showFilterDialog();
		});
		
	}
	
	switchTableMode(icon){
		if (this.table_mode==="table"){
			icon.removeClass("fa-chart-bar");
			icon.addClass("fa-table");
			$("#the-table-div-1").hide();
			$("#the-table-div-2").show();
			this.table_mode="graphs";
			this.image_table.resize();
			this.image_slider.show();
			
		}
		else{
			icon.removeClass("fa-table");
			icon.addClass("fa-chart-bar");
			$("#the-table-div-2").hide();
			$("#the-table-div-1").show();
			this.table_mode="table";
			this.image_slider.hide();
			
			
		}
	}
	
	tagFilteredItems(){
		let items = this.table.data_view.getFilteredItems();
		let val = this.tag_column_value.val();
		let field = this.tag_column_select.val();
		if (!field){
			return;
		}
        let ids=[]
        for (let item of items){
        	ids.push(item.id)
            if (val){
                item[field]=val;
            }
            else{
                delete item[field];
            }
        }
        this.executeProjectAction("update_tagging_column",{ids:ids,value:val,field:field}).then(function(e){
        	
        })
        this.table.data_view.listeners.data_changed.forEach((func)=>{func(field)});
        this.table.grid.invalidate();
        //this.tablegrid.render();

	}
	
	saveState(){
		let data={
				graphs:this.filter_panel.getGraphs()
		}
		$.ajax({
			url:"/meths/update_object/"+this.project_id,
			contentType:"application/json",
			type:"POST",
			dataType:"json",
			data:JSON.stringify(data)
		}).done(function(response){
			if (response.success){
				new MLVDialog("The project has been saved",{type:"success"});
			}
			else{
				new MLVDialog(response.msg,{type:"danger"});
			}			
		})
		
	}

	
	
}





class ChooseExperimentDialog{
	constructor(project_id,div){
		this.outer_div= $("#"+div)
		this.div=$("<div>").attr("class","row").appendTo(this.outer_div);
		this.project_id=project_id;
		this.executeProjectAction("get_all_experiments").then(resp=>{
			this.init(resp.data);
		})
	}
	
	init(data){
		let self =this;
		let e_div =$("<div>").attr("class","col-sm-2").append("<h5>1. Select Experiment</h5>").appendTo(this.div);
		this.exp_div = $("<div>").attr("class","list-group").appendTo(e_div);
		let r_div =$("<div>").attr("class","col-sm-4").append("<h5>2. Select Rows</h5>").appendTo(this.div);
		this.row_div = $("<div>").attr("class","list-group ").appendTo(r_div);
		let c_div =$("<div>").attr("class","col-sm-6").append("<h5>3. Select Columns</h5>").appendTo(this.div);
		this.column_div=$("<div>").attr("class","list-group ").appendTo(c_div);
		for (let item of data){
			let lgi= $("<div>").attr("class","list-group-item dv-hover")
			.click(function(e){
				self.loadExperiment($(this).data("exp"));
				$(".dv-hover").css("background-color","white");
				$(this).css("background-color","lightgray");
			})
			.data("exp",item)
			.appendTo(this.exp_div);
			let o = $("<div>").attr("class","d-flex w-100 justify-content-between").appendTo(lgi);
			$("<h5>").text(item.name).appendTo(o);
			$("<small>").text(item.data["item_count"]).appendTo(o);
			$("<p>").text(item.description).appendTo(lgi);
			
		}
		let d = $("<div>").attr("class","d-flex justify-content-center").appendTo(this.outer_div);
		$("<button>").text("Submit").attr("class","btn btn-primary")
		.click(function(e){
			self.submit()
		})
		.appendTo(d);
		
		
	}
	
	loadExperiment(exp){
		this.executeProjectAction("get_experiment_columns",{id:exp.id}).then(resp=>{
			this.populateGetRows(resp.data,exp);
		})
	}
	
	populateGetRows(cols,exp){
		this.row_div.empty();
		this.column_div.empty();
		let col_name_list = [];
		this.id_to_col={};
		let self = this;
		this.experiment= exp.id;
		for (let item of cols){
			col_name_list.push({
				label:item.name,
				value:item.id
				
			});
			this.id_to_col[item.id]=item;
		}
		let count = exp.data["item_count"];
		let all_div=$("<div>").attr("class","list-group-item sr-item").appendTo(this.row_div);
		
		$("<input>").attr({type:"radio",name:"mev-row-choice",value:"all","class":"dv-large-radion"})
		.appendTo(all_div);
		$("<span>").text("All Rows("+count+")").appendTo(all_div)
	
		
		
		let subset_div=$("<div>").attr("class","list-group-item sr-item").appendTo(this.row_div);
		$("<input>").attr({type:"radio",name:"mev-row-choice",value:"subset"}).appendTo(subset_div);
		$("<span>").text("Subset").appendTo(subset_div);
		let suggest = Math.ceil(count/1000)*100;
		this.count_input= $("<input>").attr({type:"text",value:suggest}).appendTo(subset_div);
		

		let query_div=$("<div>").attr("class","list-group-item sr-item").appendTo(this.row_div);
		$("<input>").attr({type:"radio",name:"mev-row-choice",value:"query"}).appendTo(query_div);
		$("<span>").text("Query").appendTo(query_div);
		let df = $("<div>").appendTo(query_div);
		this.query= new RowQueryBuilder(col_name_list,this.id_to_col,df);
		
		
	
		this.column_choose = new MEVColumnCheck(this.column_div,cols,null,this.experiment,this.project_id);
		
		$("input[name=mev-row-choice]").click(function(e){
			$(".sr-item").css("background-color","white");
			if ($(this).val()==="subset"){
				self.count_input.focus();
			}
			if ($(this).val()==="query"){
				self.query.focus();
			}
			$(this).parent().css("background-color","lightgray");
		})
	
		
		
	}
	
	submit(){
		let to_send ={};
		let data= {}
		let query_type = $("input[name=mev-row-choice]:checked").val();
		to_send.experiment=this.experiment;
		let cols =this.column_choose.getCheckedColumns();
		to_send.fields = cols.columns;
		to_send.sample_fields= cols.sample_columns;
		if (query_type ==="subset"){
			data.count= parseInt(this.count_input.val())
		}
		else if (query_type === "query"){
			data.query= this.query.getQuery()
		}
		to_send.data=data;
		to_send.query_type=query_type;
		new WaitingDialog("Processing").wait("Processing");
		
		this.executeProjectAction("build_experiment_query",to_send).then(function(resp){
			location.reload();
		})
		
	}
	
	
	
	
	
	executeProjectAction(action,args){
		if (!args){
			args={}
		}
		
		let data={
			method:action,
			args:args	
		}
	
		return fetch("/meths/execute_project_action/"+this.project_id,
		{
			method:"POST",
			body:JSON.stringify(data),
			headers:{
				"Accept":"application/json,text/plain,*/*",
				"Content-Type":"application/json"
			}
			
		}).then(resp=>resp.json());
	}
	
	
}

class MEVColumnCheck{
	constructor(div,columns,filter,exp_id,proj_id){
		this.columns=columns;
		
		this.calculateGroups(columns,filter);
		this.exp_id=exp_id;
		this.project_id=proj_id;
		let self = this;

		for (let name of this.group_names){
			let li = this.groups[name];
			
			let ti = $("<h6>").text(name).appendTo(div);	
			let col_div=$("<div>").appendTo(div);
			if (li.length>100){
				let li_input = $("<i class = 'fas fa-list mev-icon'></i>").click(function(e){
					self.showGeneListInput(col_div)
				}).appendTo(col_div);
				continue;
				
			}
			this.addGroupCheckBox(ti,col_div);
			
			
			
		
			for (let col of li){
				let parent =$("<div class='form-check form-check-inline'></div>");
				let id = "cluster-field-"+col.id;
				let check = $("<input>").attr({
					"class":"form-check-input",
					type:"checkbox",
					id:id
				}).data("id",col.id);
				let label = $("<span>").attr({
					"for":id
					}).text(col.name)
					parent.append(check).append(label).appendTo(col_div);
			}
		}
		
	}
	
	getGeneInfo(gene_list,exp_id,div){
		let args = {
				exp_id:exp_id,
				gene_list:gene_list
				
		};
		let self =this;
		this.executeProjectAction("get_gene_info",args).then(function(resp){
				console.log(resp.success);
				for (let gene of resp.data){
					self.addChosenGene(gene.name,gene.id,div);
				}
		});
	}
	executeProjectAction(action,args){
		if (!args){
			args={}
		}
		
		let data={
			method:action,
			args:args	
		}
	
		return fetch("/meths/execute_project_action/"+this.project_id,
		{
			method:"POST",
			body:JSON.stringify(data),
			headers:{
				"Accept":"application/json,text/plain,*/*",
				"Content-Type":"application/json"
			}
			
		}).then(resp=>resp.json());
	}
	
	
	addChosenGene(gene_name,gene_id,div){
		let parent =$("<div class='form-check form-check-inline'></div>");
		let id = "cluster-field-"+gene_id;
		let check = $("<input>").attr({
			"class":"form-check-input",
			type:"checkbox",
			id:id
		}).data("id",gene_id).prop("checked",true);
		let label = $("<span>").attr({
			"for":id
			}).text(gene_name)
			parent.append(check).append(label).appendTo(div);
		
	}
	
	showGeneListInput(div){
		let ta= $("<textarea>").css("width","100%");
		let self =this;
		$("<div>").append(ta).dialog({
			close:function(){
				$(this).dialog("destroy").remove();
			},
			title:"Paste Gene List",
			buttons:[{
				text:"submit",
				click:function(e){
					self.getGeneInfo(ta.val().split(/(\s+)/).filter(Boolean),self.exp_id,div);
					$(this).dialog("close");
					
				}
			}]
			
		}).dialogFix();
		
	}
	
	
	addGroupCheckBox(loc,div){
		$("<input>").attr({type:"checkbox"}).appendTo(loc)
		.click(function(e){
			let c= $(this).prop("checked")
			div.find("input").prop("checked",c)
		})
	}
	
	getCheckedColumns(){
		let ch_li=[];
		let sc_li=[];
		for (let c of this.columns){
			if ($("#cluster-field-"+c.id).prop("checked")){
				if (c.group==="Sample"){
					sc_li.push(c.id)
				}
				else{
					ch_li.push(c.id)
				}
			}
		}
		return {"columns":ch_li,"sample_columns":sc_li};
	}
	
	calculateGroups(columns,filter){
		let groups={};
		let group_list= [];
		groups["Other"]=[]
		
		for (let c of columns){
			if (filter && filter === "number"){
				if (c.datatype !=="integer" && c.datatype !== "double"){
					continue;s
				}
			}
			if (c.group){
				let li = groups[c.group]
				if (!li){
					li=[];
					group_list.push(c.group)
					groups[c.group]=li
				}
				li.push(c)
			}
			else{
				groups["Other"].push(c)
			}
		}
		for (let g in groups){
			let li = groups[g];
			li.sort(function(a,b){
				return a.name.localeCompare(b.name)
			})
		}
		group_list.sort(function(a,b){
			return a.localeCompare(b);
		
		});
		group_list.push("Other")
		this.groups=groups;
		this.group_names=group_list;
	}
	
	
}

class RowQueryBuilder{
	constructor(columns,id_to_col,div){
		let self = this;
		this.id_to_col=id_to_col;
		this.field_input=$("<input>").appendTo(div)
		.autocomplete({
			source:columns,
			select:function(e,ui){
				self.updateOperand(ui.item.value);
				 e.preventDefault();
				 $(this).val(ui.item.label);
				 self.field_id=ui.item.value;
			}
		})
		this.operand_select = $("<select>").appendTo(div);
		this.value_input = $("<input>").appendTo(div)
		
	}
	
	focus(){
		this.field_input.focus();
	}
	
	getQuery(){
		return {
			field:this.field_id,
			operand:this.operand_select.val(),
			value:this.value_input.val()
						
		}
	}
	
	updateOperand(col_id){
		let col = this.id_to_col[col_id];
		let sel = this.operand_select;
		sel.empty();
		if (col.datatype==="text"){
			sel.append($("<option>").text("!=").val("!="));
			sel.append($("<option>").text("=").val("="));
			sel.append($("<option>").text("in").val("in"));
		}
		else{
			sel.append($("<option>").text("=").val("="));
			sel.append($("<option>").text(">").val(">"));
			sel.append($("<option>").text("<").val("<"));
			sel.append($("<option>").text("!=").val("!="));
		}
	}
	
}
