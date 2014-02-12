set search_path=public;

create extension if not exists postgis;
create extension if not exists plsh;
create extension if not exists json_build;
-- Foreign Stuff
create extension if not exists postgres_fdw;

create server ceic
FOREIGN DATA WRAPPER postgres_fdw 
OPTIONS (
	host 'ckan.casil.ucdavis.edu', 
	dbname 'ceic', 
	port '5432');


drop schema e cascade;
create schema e;

drop schema ckan cascade;
create schema ckan;

create user mapping for quinn 
server ceic
options (user 'quinn',password 'r6ikQDjLv9fu');

create foreign table if not exists e."vocabulary" (
    id text NOT NULL,
    name text NOT NULL
) server ceic
OPTIONS (
	schema_name 'public'
);

create foreign table if not exists e."user" (
    id text NOT NULL,
    name text NOT NULL,
    apikey text,
    created timestamp without time zone,
    about text,
    openid text,
    password text,
    fullname text,
    email text,
    reset_key text,
    sysadmin boolean DEFAULT false,
    activity_streams_email_notifications boolean DEFAULT false
) server ceic
OPTIONS (
	schema_name 'public'
);

CREATE foreign table if not exists e."group" (
    id text NOT NULL,
    name text NOT NULL,
    title text,
    description text,
    created timestamp without time zone,
    state text,
    revision_id text,
    type text NOT NULL,
    approval_status text,
    image_url text,
    is_organization boolean DEFAULT false
) server ceic
OPTIONS (
	schema_name 'public'
);


CREATE foreign TABLE if not exists e.package (
    id text NOT NULL,
    name character varying(100) NOT NULL,
    title text,
    version character varying(100),
    url text,
    notes text,
    license_id text,
    revision_id text,
    author text,
    author_email text,
    maintainer text,
    maintainer_email text,
    state text,
    type text,
    owner_org text,
    private boolean DEFAULT false
) server ceic
OPTIONS (
	schema_name 'public'
);


create or replace FUNCTION public.ckan_api(host text,cmd text,dat json,key text) 
RETURNS json as 
$$
BEGIN
--RAISE NOTICE 'ckan(Auth:%) %> %/%',key,dat,host,cmd;
RETURN (ckan_api_sh(host,cmd,dat::text,key))::json;
END;
$$ LANGUAGE 'plpgsql';

create or replace FUNCTION public.ckan_api_sh(host text,cmd text,json text,key text) 
RETURNS text as
$$
#! /bin/bash
ckan=http://$1/api/3/action;
#echo curl -s -H Authorization:$4 --data @- $ckan/$2 $3
echo $3 | curl -s -H Authorization:$4 --data @- $ckan/$2
$$ LANGUAGE plsh;

create or replace FUNCTION public.rot13(in text)
RETURNS text AS
$$
#! /bin/bash
echo "$1" | tr '[N-ZA-Mn-za-m5-90-4]' '[A-Za-z0-9]'
$$ LANGUAGE plsh;

drop schema ckan cascade;
create schema ckan;
set search_path=ckan,public;

create table ckan.dataset_keep(
id integer,
keep boolean,
title text);

\COPY ckan.dataset_keep from dataset_keep.csv with csv header

create or replace view ckan.user as 
with last as (
select user_id, 
max(TIMESTAMP WITH TIME ZONE 'epoch' + activity_date * INTERVAL '1 second') 
as last 
from activity_vw 
group by user_id
),
u as (
select user_id from user_group 
join last using (user_id) 
where last > '2012-01-01'::date
union select gforge_user_id 
from ceic.dataset join ckan.dataset_keep using (id)
where keep is true
),
d as (
select distinct * from users join u using (user_id)
),
c as (
select user_name as name,rot13(user_name||email) as password, 
realname as fullname,email 
from d 
)
select row_to_json(c) as user from c;

create type org_user as (name text,capacity text);

create or replace view ckan.organization as 
with k as ( 
select distinct ceic_node_id as id 
from ceic.dataset 
join ckan.dataset_keep using (id)),
c as (
 select id,array_agg((user_name,role_name)::org_user) as users from 
 k join ceic.ceic_node n using (id) 
 join public.user_group g on (n.gforge_group_id=g.group_id) 
 join public.users u using (user_id)
 join public.role r using (role_id)
 group by id
),
g as (
select lower(shortname) as name,title,description,
coalesce(users,ARRAY[]::org_user[]) as users
from ceic.ceic_node join k using (id)
left join  c using (id)
)
select row_to_json(g) as organization from g;

create type ckan.org_member as (id text,username text,role text);

create or replace view ckan.organization_member as 
with v(role_name,role) 
as (
VALUES
('Default','admin'),
('Admin','admin'),
('Senior Developer','editor'),
('Junior Developer','editor'),
('Observer','member'),
('Doc Writer','member'),
('Support Tech','member')
),
k as ( 
select distinct ceic_node_id as id 
from ceic.dataset 
join ckan.dataset_keep using (id)),
c as (
 select e.id as id ,user_name as username,role as role  from 
 k join ceic.ceic_node n using (id)
 join e."group" e on (lower(n.shortname)=e.name)
 join public.user_group g on (n.gforge_group_id=g.group_id) 
 join public.users u using (user_id)
 join public.role r using (role_id)
 join v using (role_name)
)
select row_to_json(c) as organization_member from c;


create or replace function 
ckan.url2fn (text,out text) as $$ 
select 
regexp_replace(g.unix_group_name||'/'||p.name||'/'||r.name||'/'||f.filename,'[ :]','','g') 
from frs_file f 
join frs_release r 
using (release_id) 
join frs_package p 
using (package_id) 
join groups g 
using (group_id) 
where file_id=regexp_replace($1,'^.*download.php/(\d+)/.*','\1')::integer; 
$$ LANGUAGE SQL;

-- Even though join is in place, I am actually using original relation_type.
create or replace view ckan.dataset_resources as 
with v(relation_type,resource_type) 
as (
VALUES
('Metadata','metadata'),
('Preview','preview'),
('Other','documentation'),
('CSV','table'),
('Website','website'),
('KML','kml'),
('Download','download'),
('Link','documentation'),
('','documentation'), 
('Documentation','documentation'),
('Document','documentation'),
('Map Service','map')
),
r as (
 select dataset_id,relation_type,related_resource_uri,mime_type,
 row_number() over (partition by dataset_id,relation_type)  as count from ceic.dataset_relation
 where resp_code ~~ '2__'::text OR resp_code ~~ '3__'::text
)
select dataset_id as id,build_json_array(
array_agg(build_json_object(
'name',relation_type||case when (count=1) THEN '' ELSE '_'||count END,
'format',relation_type,
'url',related_resource_uri,
'mimetype',mime_type))) as resources
from r 
join v 
using (relation_type)
group by dataset_id;

create or replace view dataset_topics as 
WITH w AS (
SELECT string_to_array(vocab.pathterm::text, ':'::text) AS p
FROM ceic.vocab
WHERE lower(vocab.vocab::text) = ANY 
(ARRAY['ceres:themes'::text, 'iso:categories'::text])
), 
v AS (
SELECT DISTINCT w.p[array_length(w.p, 1)] AS term
FROM w
),
t AS (
SELECT DISTINCT 
dataset_theme.dataset_id, dataset_theme.themekt, dataset_theme.themekey
FROM ceic.dataset_theme
WHERE dataset_theme.themekt::text = 'Topic'::text
),
top AS (
SELECT t.dataset_id, t.themekt::text AS vocabulary_id,v.term AS name
FROM v
JOIN t ON lower(t.themekey::text) = lower(v.term)
),
contrib as (
select dataset_id::numeric,'Contributor'::text as vocabulary_id,
name 
from ceic.dataset_org 
where name ~ E'^[a-zA-Z1-9 _\.\-]+$'
)
select dataset_id,vocabulary_id,name from top
union
select dataset_id,vocabulary_id,name from contrib;

-- create or replace view dataset_orgs as 
-- with a as (
--  select term,
--  regexp_replace(regexp_replace(coalesce(searchon,term),',\s*$',''),
--                 ', ([A-Z]+)$',' \1') as new 
--  from ceic.publisher
-- )
-- ,
-- f(new,rep) as (
--  VALUES('California Department of Fish and Game, DFG, California Department of Fish and Wildlife [DFW]','California Department of Fish and Game [DFG]'),
--  ('CalEPA,Cal EPA','CalEPA')
-- ) 
-- select coalesce(rep,new) as term 
-- from a 
-- left join f using (new);


-- create or replace view dataset_themes as
-- with nt AS (
-- SELECT DISTINCT dataset_theme.dataset_id, 
-- initcap(dataset_theme.themekt::text) AS vocab, 
-- array_to_string(array_agg(dataset_theme.themekey), ','::text) AS term
-- FROM ceic.dataset_theme
-- WHERE dataset_theme.themekey IS NOT NULL 
-- AND dataset_theme.themekt IS NOT NULL 
-- AND dataset_theme.themekt::text <> 'Topic'::text
-- GROUP BY dataset_theme.dataset_id, dataset_theme.themekt
-- ),
-- u AS (
-- SELECT nt.dataset_id, nt.vocab, nt.term
-- FROM nt
-- UNION 
-- SELECT top.dataset_id, top.vocab, top.term
-- FROM top
-- )
-- SELECT u.dataset_id, 
-- string_agg('{"vocabulary_id":"'||u.vocab||'","name":"'||u.term||'"}',',') 
-- AS themes
-- FROM u
-- GROUP BY u.dataset_id;

-- Bounding Box needs to come from dataset_places
-- Use clips only sum up.
create or replace view ckan.dataset_is_public as 
select i.id as id,
CASE when (i.ispublic and n.is_public = 1) then true 
else false END as public 
from ceic.dataset i join ceic.ceic_node n on (i.ceic_node_id = n.id);

create or replace view ckan.dataset_spatial as 
select id as dataset_id,
CASE WHEN (wkt like '%POINT%' or wkt like '%POLYGON%')
THEN
st_asGEOJSON((st_dump(st_transform(
st_geomFromEWKT(regexp_replace(wkt,'SRID:','SRID=')),4269))).geom)::JSON
WHEN ((eastbc is not null and southbc is not null and westbc is not null and northbc is not null)
     and (eastbc != 0 or southbc !=0 or westbc != 0 or northbc != 0))
THEN
st_asGeoJSON(st_setsrid(st_makebox2d(
	st_makepoint(westbc,southbc),
	st_makepoint(eastbc,northbc)),4269))::JSON
END as spatial
from ceic.dataset where
(wkt like '%POINT%' or wkt like '%POLYGON%') or
((eastbc is not null and southbc is not null and westbc is not null and northbc is not null)
 and (eastbc != 0 or southbc !=0 or westbc != 0 or northbc != 0));


create or replace view ckan.dataset_extras 
AS 
SELECT i.id,
build_json_array(
build_json_object('entered',
      COALESCE(to_char(i.create_date::timestamp with time zone, 
     'YYYY-MM-DD'::text), '2010-01-01'::text)),
build_json_object('purpose',i.purpose),
build_json_object('currentness',i.currentness),
build_json_object('update_frequency',i.update),
build_json_object('progress',i.progress),
build_json_object('use_constraints',i.useconstraints),
build_json_object('pkg_type',i.fedcat),
build_json_object('spatial',spatial),
build_json_object('org_name',cg.name)
) as extras
from ceic.dataset i
left join ckan.dataset_spatial s on (i.id= s.dataset_id)
left join public.groups gg on (gg.group_id=i.gforge_group_id)
left join e."group" cg on (gg.unix_group_name=cg.name);

create view ckan.dataset_tags as 
select dataset_id as id,
array_to_json(
array_agg(
build_json_object('vocabulary_id',vocabulary_id,'name',name)))
as tags
from ckan.dataset_topics t 
group by dataset_id;


create or replace view ceic.dataset_resources as 
select dataset_id as id,
array_to_json(
array_agg(
build_json_object(
'format', relation_type,
'url',related_resource_uri,
'mimetype',mime_type))) as resources
from ceic.dataset_relation
group by dataset_id;


create or replace view ckan.datasets AS
with n as (
select  
id,
ceic_node_id,
left(regexp_replace(
     regexp_replace(lower(trim(both from i.title)),'[^a-z_0-9]+','_','g'),
                   '([^_][^_][^_][^_])[^_]+(_|$)','\1\2','g'),95) as name 
from 
ceic.dataset i join
ckan.dataset_keep using (id)
where keep is true
),
r as (
select id,
name,
row_number() over (partition by name order by id) 
from n
),
idd as (
select id,
case when (row_number>1) then name || '_'|| row_number ELSE name END as name
from r
)
SELECT
 idd.name,
 i.title,
 i.data_name as author,
 i.data_email as author_email,
 i.data_name as maintainer,
 i.data_email as maintainer_email,
-- license_id,
not(p.public) as private,
i.abstract as notes,
'active'::text as state,
'dataset'::text as type,
r.resources as resources,
t.tags as tags,
e.extras as extras,
-- "relationships_as_object",rel.rel_list,
-- "relationships_as_subject",rel.sub_list,
-- "groups",group.list
cg.id as owner_org
FROM ceic.dataset i 
join idd using (id)
left join ckan.dataset_tags t using (id)
left join ckan.dataset_extras e using (id)
left join ckan.dataset_resources r using (id)
left join ckan.dataset_is_public p using (id)
join ceic.ceic_node n on (i.ceic_node_id=n.id)
join e."group" cg on (lower(n.shortname)=cg.name);


create view ckan.package
as select row_to_json(d) as package
from 
ckan.datasets d;

create or replace view ckan.vocabulary as 
with keep as (
select id as dataset_id 
 from ceic.dataset i
 join dataset_keep using (id) 
 where keep is true
),
a as (
 select distinct vocabulary_id,
 regexp_replace(name,' & ',' and ') as name 
 from ckan.dataset_topics
 join keep using (dataset_id)
 where name ~ '^[A-Za-z0-9 ]+$'
 order by vocabulary_id,name
) 
select 
 vocabulary_id,
 build_json_object('name',vocabulary_id,
 'tags',array_to_json(array_agg(
    build_json_object('name',name)))) as vocabulary  
from a 
group by vocabulary_id;

create or replace view ckan.tag as 
with keep as (
select id as dataset_id 
 from ceic.dataset i
 join dataset_keep using (id) 
 where keep is true
),
a as (
 select distinct vocabulary_id,
 regexp_replace(name,' & ',' and ') as name 
 from ckan.dataset_topics
 join keep using (dataset_id)
 order by vocabulary_id,name
) 
select 
 a.vocabulary_id,
 a.name,
 build_json_object('vocabulary_id',v.id,
 'name',a.name) as tag 
from a join e.vocabulary v on (a.vocabulary_id=v.name) ;

-- -- To install
-- with k as (
--  select apikey from e."user" where name='quinn'
-- ) 
-- select 
-- ckan_api_sh('ceic.casil.ucdavis.edu','vocabulary_create',v.vocabulary::text,
-- 	apikey) 
-- from ckan.vocabulary v,k;

-- You may want to install one at a time:
--with k as (
-- select apikey from e."user" where name='quinn'
--) 
--select 
--ckan_api('ceic.casil.ucdavis.edu','tag_create',t.tag,
--apikey) 
--from ckan.tag t,k where vocabulary_id='Contributor';


-- with k as (
--  select apikey from e."user" where name='quinn'
-- ) 
-- select 
-- ckan_api_sh('ceic.casil.ucdavis.edu','user_create',c.user::text,apikey) 
-- from ckan."user" c,k;

-- with k as (
--  select apikey from e."user" where name='quinn'
-- ) 
-- select 
-- ckan_api('ceic.casil.ucdavis.edu','organization_create',o.organization,apikey) 
-- from ckan.organization o,k;


-- with k as (
-- select apikey from e."user" where name='quinn'
-- ),
-- p as (
--  select p.owner_org as org_id,
--   array_agg(p.id) as datasets 
--  from e.package p join ckan.datasets d using (name) 
--  where d.private is true 
--  group by p.owner_org),
-- j as (select row_to_json(p) as priv from p)
-- select 
-- ckan_api('ceic.casil.ucdavis.edu','bulk_update_private',priv,apikey) 
-- from j,k;

-- psql -t -A --pset=footer -d gforge -c 'select to_json(array_agg(package)) from ckan.package' > ckan_package.json

