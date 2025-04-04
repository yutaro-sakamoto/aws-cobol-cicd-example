FROM ubuntu:24.04

RUN apt-get update
RUN apt-get install -y build-essential gettext autoconf bison flex default-jdk

COPY opensourcecobol4j/ .
RUN cd opensourcecobol4j/ && ./configure && make && make install

COPY prog.cbl .
RUN cobj prog.cbl

FROM ubuntu:24.04

WORKDIR /app

#COPY --from=0 /usr/lib/opensourcecobol4j/libcobj.jar /usr/lib/opensourcecobol4j/libcobj.jar
#COPY --from=0 *.class .

RUN apt-get update
RUN apt-get install -y default-jdk

COPY build /app/build
RUN cd /app/build && ./gradlew build

# TODO: fix the following command to run a web server
CMD ["java", "-cp", "/usr/lib/opensourcecobol4j/libcobj.jar:.","prog"]
#FROM nginx:1.27.4
#
#RUN echo '<h1>hello</h1>' > /usr/share/nginx/html/index.html
#
#EXPOSE 80
#
#CMD ["nginx", "-g", "daemon off;"]