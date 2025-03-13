FROM ubuntu:24.04

RUN apt-get update
RUN apt-get install -y build-essential gettext autoconf bison flex default-jdk

COPY opensourcecobol4j/ .
RUN cd opensourcecobol4j/ && ./configure && make && make install