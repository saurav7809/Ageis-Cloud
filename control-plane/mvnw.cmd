@ECHO OFF
REM AegisCloud Control Plane — Maven Wrapper (Windows)
SET MVN_PATHS=^
C:\Users\gaura\.m2\wrapper\dists\apache-maven-3.9.6-bin\439sdfsg2nbdob9ciift5h5nse\apache-maven-3.9.6\bin\mvn.cmd ^
C:\Users\gaura\.m2\wrapper\dists\apache-maven-3.9.15-bin\4rlcemksed9vjmkvgss0jpc4po\apache-maven-3.9.15\bin\mvn.cmd ^
C:\Users\gaura\.m2\wrapper\dists\apache-maven-3.9.14-bin\1cb7fhup6b5n3bed6kckbrnspv\apache-maven-3.9.14\bin\mvn.cmd

FOR %%M IN (%MVN_PATHS%) DO (
    IF EXIST "%%M" (
        SET MVN_CMD=%%M
        GOTO :FOUND
    )
)
WHERE mvn >NUL 2>&1
IF NOT ERRORLEVEL 1 ( SET MVN_CMD=mvn & GOTO :FOUND )
ECHO ERROR: Maven not found. & EXIT /B 1

:FOUND
"%MVN_CMD%" %*
