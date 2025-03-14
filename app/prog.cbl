       IDENTIFICATION          DIVISION.
       PROGRAM-ID.             prog.
       ENVIRONMENT             DIVISION.
       CONFIGURATION           SECTION.
       DATA                    DIVISION.
       WORKING-STORAGE         SECTION.
       LINKAGE                 SECTION.
       01  DATA1               PIC 9(09).
       01  DATA2               PIC 9(09).
       01  DATA3               PIC 9(09).
       01  SUM-DATA            PIC 9(09).
       PROCEDURE               DIVISION
                               USING  DATA1,
                                      DATA2,
                                      DATA3,
                                      SUM-DATA.
       MAIN-SECTION.
           ADD DATA1 DATA2 DATA3 TO SUM-DATA.
       GOBACK.