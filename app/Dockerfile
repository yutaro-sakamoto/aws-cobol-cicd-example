#FROM ubuntu:24.04
#
#RUN apt-get update
#RUN apt-get install -y build-essential gettext autoconf bison flex default-jdk
#
#COPY opensourcecobol4j/ .
#RUN cd opensourcecobol4j/ && ./configure && make && make install
#
#COPY prog.cbl .
#RUN cobj prog.cbl
#
#FROM ubuntu:24.04
#COPY --from=0 /usr/lib/opensourcecobol4j/libcobj.jar /usr/lib/opensourcecobol4j.jar
#COPY --from=0 *.class .
#
#CMD ["java", "-cp", "/usr/lib/opensourcecobol4j.jar:.","prog"]
FROM nginx:latest

RUN echo '<h1>hello</h1>' > /usr/share/nginx/html/index.html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]