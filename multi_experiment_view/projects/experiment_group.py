
from app.ngs.project import GenericObject,projects,create_project,get_project
from app import databases,app
import ujson,os,csv
from numpy.ma.core import ids


data_types={
    "residuals":{"name":"Residuals"},  
    "expression":{"name":"Expression"}
}

class ExperimentGroup(GenericObject):
    '''
    clusters should be {cluster_id:{"name":"xyz","size":2002}}
    '''
    def addExperiment(self,exp_id,field_id,clusters):
        self.data["experiments"][exp_id]={
            "field":field_id
        }
        for cluster_id in clusters:
            self.data["cluster_id"][exp_id]=clusters[cluster_id]
        self.data["clusters"][exp_id]=clusters
        self.update()
        
    '''
    clusters should be {cluster_id:{"name"}}
    '''
    def addClusters(self,clusters):
        self.data["clusters"]=clusters
        self.update()
        
    def add_experiment_data(self,type,datafile,chunksize=1000):
        sql = "SELECT COUNT(*) AS num FROM mev_samples"
        sample_num= databases["system"].execute_query(sql)[0]["num"]
        table=self.data["tables"][type]
        with open(datafile) as df:   
            reader = csv.DictReader(df,delimiter="\t")
            fields = reader.fieldnames
            update_list=[]
            count=0
            for row in reader:
                item={"field_id":int(row["field_id"]),"exp_id":int(row["exp_id"])}
                for c in self.data["clusters"]:       
                    li=[]
                    for s in range(1,sample_num+1):
                        try:
                            li.append(float(row["{}_{}".format(s,c)]))
                        except:
                            li.append(None)
                    item["c"+c]=li
                update_list.append(item)
                count+=1
                if len(update_list)==chunksize:
                    print(count)
                    databases["system"].insert_dicts_into_table(update_list,table)
                    update_list=[]
            databases["system"].insert_dicts_into_table(update_list,table)
            update_list=[]          
    
    def get_individual_gene_data(self,gene_id,type):
           table = self.data["table"]
           sql = "SELECT * FROM {} WHERE field_id = %s AND type=%s".format(table)
           return databases["system"].execute_query(sql,(gene_id,type))[0]
       
    def get_pca_view(self,cluster):
        table = self.data["tables"]["other"]
        sql = "SELECT field_id,c{}  FROM {} WHERE field_id=ANY('{{1,2}}')".format(cluster,table)
        return databases["system"].execute_query(sql)
    
    def get_gene_data(self,gids,cluster,type):
        data=[]
        table = self.data["table"]
        col = "c{}".format(cluster)
        sql = "SELECT field_id,exp_id,{} FROM {} WHERE field_id = ANY(%s) AND type=%s".format(col,table)
        data =databases["system"].execute_query(sql,(gids,type))
        return data
    
    def add_sample_group(self,name,ids):
        path = os.path.join(self.get_folder(),"sample_groups.json")
        info={}
        if os.path.exists(path):
            i = open(path)
            info=ujson.loads(i.read())
            i.close()
        info[name]=ids
        o=open(path,"w")
        o.write(ujson.dumps(info))
        o.close()
        
    def get_sample_groups(self):
        path =os.path.join(self.get_folder(),"sample_groups.json")
        sample_groups={}
        if (os.path.exists(path)):
            sample_groups= ujson.loads(open(path).read())
        return sample_groups
        
        
        
    
                    
    def get_samples(self):
        pass          
            
    def create_tables(self):
        file_name = os.path.join(app.root_path,"modules","multi_experiment_view","jobs","create_exp_group_table.sql")
        for type in data_types:
            table_name= "exp_group_{}_{}".format(type,self.id)
            self.data["tables"][type]=table_name
            self.update()
            cols = []
            for cid in self.data["clusters"]:
                cols.append( "c{} double precision[]".format(cid))
            script = open (file_name).read().format(db_user=app.config['DB_USER'],table_name=table_name,extra_columns=",\n".join(cols))
            databases["system"].run_script(script)
    
    
    def load_other_data(self,datafile,names_to_id,exp_id):
        clusters={}
        for cid in self.data["clusters"]:
            clusters[self.data["clusters"][cid]["name"]]=cid
        samples={}
        sql = "SELECT * FROM mev_samples"
        res = databases["system"].execute_query(sql)
        for r in res:
            samples[r["name"]]=r["id"]
        with open(datafile) as df:   
            reader = csv.DictReader(df,delimiter="\t")
            fields = reader.fieldnames
            update_list=[]
            count=0
            
            for name in names_to_id:
                item= {"field_id":names_to_id[name],"exp_id":exp_id}
                for cid in self.data["clusters"]:
                    item["c"+cid]= [None]*len(samples)
                update_list.append(item)
            for row in reader:
                count=0
                for name in names_to_id:
                    
                    for c_name in clusters:
                        val= row[c_name+"_"+name]
                        index = samples[row['sid']]-1
                        try:
                            val=float(val)
                        except:
                            val=None
                        update_list[count]["c"+clusters[c_name]][index]=val
                    count+=1   
                        
            databases["system"].insert_dicts_into_table(update_list,self.data["tables"]["other"])
                
            
        
    
    def convert_file(self,exp_id,filename,outfile):
        clusters={}
        new_name = filename.split(".")[0]
        new_name=new_name+"_num.txt"
        out = open(outfile,"w")
        for cid in self.data["clusters"]:
            clusters[self.data["clusters"][cid]["name"]]=cid
        samples={}
        p = get_project(exp_id)
        columns={}
        res= p.get_columns()
        for r in res:
            columns[r["name"]]=str(r["id"])
        sql = "SELECT * FROM mev_samples"
        res = databases["system"].execute_query(sql)
        for r in res:
            samples[r["name"]]=str(r["id"])
        with  open(filename) as f:
            first=True        
            for line in f:
                arr=line.strip().split()
                if first:
                    new_items=[]
                    for item in arr:
                        items=item.split("_")
                        new_item=samples[items[0]]+"_"+clusters[items[1]]
                        new_items.append(new_item)
                    
                    out.write("field_id\texp_id\t")
                    out.write("\t".join(new_items)+"\n")
                    first=False   
                else:
                    out.write(columns[arr[0]]+"\t"+str(exp_id)+"\t")
                    out.write("\t".join(arr[1:])+"\n")
        out.close()
        
def create_new_experiment_group(db,name,description=""):
    data = {
        "experiemnts":{},
        "clusters":{},
        "tables":{}
        
    }
    p = create_project(db,name,"experiment_group",description,returning_object=True,data=data)
    
   
    return p 



     


projects["experiment_group"]=ExperimentGroup   