from app import databases,app
import ujson,os,csv
from string import ascii_lowercase


class Experiment:
    
    def __init__(self, id):
        sql = "SELECT * FROM mev_experiments WHERE id=%s"
        rec = databases["system"].execute_query(sql,(id,))[0]
        self.id=id
        self.name=rec["name"]
        self.description=rec["description"]
        self.data=rec["data"]
        self.type=rec["type"]
        
    def get_col_name_to_field(self):
        sql = "SELECT name,field,datatype FROM mev_experiment_fields WHERE experiment=%s"
        data={}

        recs =databases["system"].execute_query(sql,(self.id,))
        for rec in recs:
            data[rec["name"]]=[rec["field"]]
            func = str
            if rec["datatype"] == "double":
                func =float
            elif rec["datatype"]=="integer":
                func=str
            data[rec["name"]].append(func)  
           
        return data
    
    def get_columns(self):
        sql = "SELECT mev_experiment_fields.name AS name ,mev_experiment_fields.id AS id,"+\
              "mev_field_groups.name as group FROM mev_experiment_fields LEFT  "+\
              "JOIN mev_field_to_group on field_id=mev_experiment_fields.id LEFT JOIN "+\
              "mev_field_groups ON group_id=mev_field_groups.id  WHERE mev_experiment_fields.experiment =%s"
         
        
        return databases["system"].execute_query(sql,(self.id,))  
    
    def create_table(self,tag):
        table_name="exp{}_{}".format(self.id,tag)
        file_name = os.path.join(app.root_path,"modules","multi_experiment_view","jobs","create_data_table.sql")
        script = open (file_name).read().format(db_user=app.config['DB_USER'],table_name=table_name)
        databases["system"].run_script(script)
        
    def insert_columns(self,columns):
    
        table = "exp{}_default".format(self.id)
        col_list=[]
        col_names=[]
        groups={}
        for col in columns:
            col_info={
                "name":col["name"],
                "datatype":col["datatype"],
                "experiment":self.id,
                "data":ujson.dumps({})
                
            }
            
            if col.get("group"):
                col_names.append(col["name"])
                existing_type= groups.get(col["group"],col["datatype"])
                if existing_type != col["datatype"]:
                    raise  Exception("mixed groups")
                groups[col["group"]]=col["datatype"]
                col_info["group"]=col["group"]
            if col.get("description"):
                col_info["description"]=col["description"]
            col_list.append(col_info)
            
        #does group exists
        sql = "SELECT id,name,field_name FROM mev_field_groups WHERE experiment=%s AND name=ANY(%s)"
        res = databases["system"].execute_query(sql,(self.id,list(groups.keys())))
        name_to_group={}
        for r in res:
            name_to_group[r["name"]]=r
            sql = "SELECT COUNT (*) AS num FROM mev_experiment_fields INNER JOIN mev_field_to_group ON mev_experiment_fields.id = mev_field_to_group.field_id WHERE group_id=%s"
            count  = databases["system"].execute_query(sql,(r["id"],))[0]["num"]
            r["count"]=count+1
            del groups[r["name"]]
        group_field_index = len(res)+3
        for group in groups:
            group_f= ascii_lowercase[group_field_index]
            sql = "INSERT INTO  mev_field_groups (name,experiment,field_name) VALUES(%s,%s,%s)"
            fid = databases["system"].execute_insert(sql,(group,self.id,group_f))
            name_to_group[group]={
                "name":group,
                "id":fid,
                "field_name":group_f,
                "count":1        
            }
            c_type="text[]"
            dt = groups[group]
            if dt=="double":
                c_type="double precision[]"
            elif dt=="integer":
                c_type="integer[]"
            
            databases["system"].add_columns(table,[{"datatype":c_type,"name":group_f}])
            group_field_index+=1
         
       
        nf_dt_counts={}
        sql = "SELECT COUNT (*) AS num FROM mev_experiment_fields WHERE experiment=%s AND field LIKE 'a[%%'"
        nf_dt_counts["text"]= databases["system"].execute_query(sql,(self.id,))[0]["num"]+1
        sql = "SELECT COUNT (*) AS num FROM mev_experiment_fields WHERE experiment=%s AND field LIKE 'b[%%'"
        nf_dt_counts["integer"]= databases["system"].execute_query(sql,(self.id,))[0]["num"]+1
        sql = "SELECT COUNT (*) AS num FROM mev_experiment_fields WHERE experiment=%s AND field LIKE 'c[%%'"
        nf_dt_counts["double"]= databases["system"].execute_query(sql,(self.id,))[0]["num"]+1
        
        
        for col in col_list:
            if col.get("group"):
                gr = name_to_group[col.get("group")]
                col["field"]=gr["field_name"]+"["+str(gr["count"])+"]"
                gr["count"]=gr["count"]+1
            else:
                if col["datatype"]=="text":
                     col["field"]="a["+str(nf_dt_counts["text"])+"]"
                     nf_dt_counts["text"]+=1
                if col["datatype"]=="integer":
                     col["field"]="b["+str(nf_dt_counts["integer"])+"]"
                     nf_dt_counts["integer"]+=1
                if col["datatype"]=="double":
                     col["field"]="c["+str(nf_dt_counts["double"])+"]"
                     nf_dt_counts["double"]+=1
        col_name_to_gid={}    
        for col in col_list:
             gr = col.get("group")
             if gr:
                 col_name_to_gid[col["name"]]= name_to_group[gr]['id']
                 del col["group"]
                  
        databases["system"].insert_dicts_into_table(col_list,"mev_experiment_fields")
        
        sql = "SELECT id,name FROM mev_experiment_fields WHERE name=ANY(%s)"
        res = databases["system"].execute_query(sql,(col_names,))
        col_name_to_id={}
        for r in res:
            col_name_to_id[r["name"]]=r["id"]
        update_list=[]
        for name in col_name_to_gid :
            update_list.append({"field_id":col_name_to_id[name],"group_id":col_name_to_gid[name]})
        
            
        databases["system"].insert_dicts_into_table(update_list,"mev_field_to_group")
        
    
            
      
    def insert_data(self,datafile,chunk_size=10000):
        table = "exp{}_default".format(self.id)
        n_to_f =self.get_col_name_to_field()
        update_list=[]
        items={}
        count=0
     
        with open(datafile) as df:
            
            reader = csv.DictReader(df,delimiter="\t")
            fields = reader.fieldnames
            for row in reader:
               
                
                item={}
                for field in fields:
                    info = n_to_f.get(field)
                    if not info:
                        continue
                    try:
                        item[info[0]]=info[1](row[field])
                    except:
                       pass
                
                
                update_list.append(item)
                    
                if len(update_list)==chunk_size:
                    databases["system"].insert_dicts_into_table(update_list,table)
                    update_list=[]
                    
            databases["system"].insert_dicts_into_table(update_list,table)
            update_list=[]          
                         
            
def create_new_experiment(name,type,description):
    sql = "INSERT INTO mev_experiments (name,type,description,data) VALUES(%s,%s,%s,%s)"
    new_id= databases["system"].execute_insert(sql,(name,type,description,ujson.dumps({})))
    file_name = os.path.join(app.root_path,"modules","multi_experiment_view","jobs","create_data_table.sql")
    table_name= "exp{}_default".format(new_id)       
    script = open (file_name).read().format(db_user=app.config['DB_USER'],table_name=table_name)
    databases["system"].run_script(script)

    
    
def _get_field_from_id(id):
    st="" 
    if (id==0):
        return "a"
    while (id>=1):
        mod = id%26
        id=id //26
        st  = ascii_lowercase[mod]+st
      
    return st

def create_table(experiment,tag):
    pass
        

                       
       

    
    
                                                   
        
    
    
    
    
    
    