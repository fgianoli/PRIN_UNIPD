DROP TABLE IF EXISTS sahel.boundaries;CREATE TABLE sahel.boundaries AS
WITH
confini AS (SELECT isocode iso2,ST_TRANSFORM(geom,4326) geom FROM sahel.confini_lineari),
capitali AS (SELECT iso_a2 iso2,geom FROM sahel.capital_sahel),
d100 AS (SELECT iso2,100 dis,ST_BUFFER(geom::geography,100000)::geometry geom FROM capitali a),
d3 AS (SELECT iso2,ST_BUFFER(geom::geography,300000)::geometry geom,300 dis FROM capitali a),
d6 AS (SELECT iso2,ST_BUFFER(geom::geography,600000)::geometry geom,600 dis FROM capitali a),
d9 AS (SELECT iso2,ST_BUFFER(geom::geography,900000)::geometry geom,900 dis FROM capitali a),
d12 AS (SELECT iso2,ST_BUFFER(geom::geography,1200000)::geometry geom,1200 dis FROM capitali a),
d18 AS (SELECT iso2,ST_BUFFER(geom::geography,1800000)::geometry geom,1800 dis FROM capitali a),
d300 AS (SELECT a.iso2,a.dis,ST_DIFFERENCE(a.geom,b.geom) geom FROM d3 a JOIN d100 b USING(iso2)),
d600 AS (SELECT a.iso2,a.dis,ST_DIFFERENCE(a.geom,b.geom) geom FROM d6 a JOIN d3 b USING(iso2)),
d900 AS (SELECT a.iso2,a.dis,ST_DIFFERENCE(a.geom,b.geom) geom FROM d9 a JOIN d6 b USING(iso2)),
d1200 AS (SELECT a.iso2,a.dis,ST_DIFFERENCE(a.geom,b.geom) geom FROM d12 a JOIN d9 b USING(iso2)),
d1800 AS (SELECT a.iso2,a.dis,ST_DIFFERENCE(a.geom,b.geom) geom FROM d18 a JOIN d12 b USING(iso2)),
buffers AS (SELECT * FROM d100 UNION SELECT * FROM d300 UNION SELECT * FROM d600 UNION SELECT * FROM d900 UNION SELECT * FROM d1200 UNION SELECT * FROM d1800 ORDER BY iso2,dis),
clipped AS (SELECT a.iso2,b.dis,(ST_DUMP(ST_INTERSECTION(a.geom,b.geom))).geom FROM confini a JOIN buffers b ON a.iso2=b.iso2 AND ST_INTERSECTS(a.geom,b.geom) ORDER BY iso2,dis)
SELECT iso2,ST_UNION(geom) geom,dis FROM clipped GROUP BY iso2,dis ORDER BY iso2,dis;
SELECT * FROM sahel.boundaries;
