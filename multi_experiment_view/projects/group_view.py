from app.ngs.project import GenericObject,projects,get_project,get_projects_summary
from app import databases,app
from random import randint
import os,ujson

class GroupView(GenericObject):
    def get_template(self,args):
        return "group_view/page.html",{}
    
    def get_group_info(self,gid=0):
        p=get_project(int(gid))
        return {
            "clusters":p.data["clusters"],
            "experiments":p.data["experiments"]
        }
    
    
    
    def get_gene_suggest(self,term="",eid=0):
        sql = "SELECT name AS label ,id AS value FROM mev_experiment_fields WHERE experiment=%s AND name ILIKE %s ESCAPE '' LIMIT 10"
        res= databases["system"].execute_query(sql,(eid,"%"+term+"%"))
        return res
        
    def get_gene_info(self,gene_list=[],exp_id=0):
        sql = "SELECT name,id  FROM mev_experiment_fields WHERE experiment =%s AND name=ANY(%s) ORDER BY name"
        return databases["system"].execute_query(sql,(exp_id,gene_list))
        
   
   
   
    def get_gene_data(self,cluster=0,group=0,type="",experiment=0,gene_ids=[]):
        p = get_project(group)
        cluster=int(cluster)
        gene_data= p.get_gene_data(gene_ids,cluster,type);
        return gene_data
     
    
       
        
    def get_individual_gene_data(self,gene_id=0,group=0,type="residuals"):
        p = get_project(int(group))
        return p.get_individual_gene_data(gene_id,type)
        
        
   
    def save_view(self,data={}):
        path = os.path.join(self.get_folder(),"current_view.json")
        o = open(path,"w")
        o.write(ujson.dumps(data))
        o.close()
        self.set_data("current_view",path)
        
    
    def get_all_groups(self):
        filters={
              "type":["experiment_group"]
        }
        groups= get_projects_summary(user_id=self.owner,filters=filters,limit=100,extra_fields=",projects.data AS data")
        for group in groups:
            group["cluster_number"]=len(group["data"]["clusters"])
            group["experiments"]=group["data"]["experiments"]
            del group["data"]
        return groups
    
    def set_group(self,group_id=0):
        group_id=int(group_id)
        p=get_project(group_id)
        self.set_data("group_id",group_id)
        self.set_data("group_name",p.name)
        return True
        
    def get_experiment_data(self,id=0):
        id = int(id)
        
          
    
    def get_data(self):

      
        clusters=None
        experiments=None
        sample_groups={}
        eg = self.data.get("group_id")
        if eg:
            p= get_project(self.data["group_id"])
            clusters=p.data["clusters"]
            experiments=p.data["experiments"]
            sample_groups=p.get_sample_groups()
            
        current_view =self.data.get("current_view")
        if current_view:
            current_view=ujson.loads(open(current_view).read())
        sample_fields=[]
        col_names=[]
        for col in app.config["MEV_SAMPLE_COLUMNS"].values():
            sample_fields.append({
                "id":col["field"],
                "field":col["field"],
                "sortable":True,
                "filterable":True,
                "name":col["name"]
            
            })
            col_names.append(col["field"])
        sql = "SELECT id,{} FROM mev_samples ORDER by id".format(",".join(col_names))   
        samples = databases["system"].execute_query(sql)   
      
        return{
            "current_view":current_view,
            "samples":samples,
            "sample_fields":sample_fields,
            "clusters":clusters,
            "experiments":experiments,
            "group_id":self.data.get("group_id"),
            "group_name":self.data.get("group_name"),
            "sample_groups":sample_groups
            
        }
        
    
    def get_view(self):
        p=get_project(self.data["experiment_group"])
        self.data[""]

GroupView.methods={
    "get_group_info":{
        "permission":"view"
        
    },
    "get_gene_suggest":{
        "permission":"view"
    },
    "get_gene_info":{
        "permission":"view"
    },
    
    "get_individual_gene_data":{
        "permission":"view"
    },
    "get_all_groups":{
        "permission":"edit"
    },
    "set_group":{
        "permission":"edit"
    },
    "save_view":{
        "permission":"edit"
    },
     "get_gene_data":{
        "permission":"view"
    }
    
}
projects["group_view"]=GroupView