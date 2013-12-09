-- Currently this is NOT a foreign table.

CREATE EXTENSION file_fdw;
CREATE SERVER csvdb FOREIGN DATA WRAPPER file_fdw;
CREATE FOREIGN table ckan.dataset_keep(
id integer,
keep boolean,
title text
)
SERVER csvdb
OPTIONS ( filename '/home/quinn/ckan/dataset_keep.csv', format 'csv' , header 't');