package jp.osscons.opensourcecobol.libcobj.user_util.indexed_file;

import java.io.File;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.OutputStream;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import jp.osscons.opensourcecobol.libcobj.common.CobolModule;
import jp.osscons.opensourcecobol.libcobj.data.AbstractCobolField;
import jp.osscons.opensourcecobol.libcobj.data.CobolDataStorage;
import jp.osscons.opensourcecobol.libcobj.data.CobolFieldAttribute;
import jp.osscons.opensourcecobol.libcobj.data.CobolFieldFactory;
import jp.osscons.opensourcecobol.libcobj.exceptions.CobolRuntimeException;
import jp.osscons.opensourcecobol.libcobj.exceptions.CobolStopRunException;
import jp.osscons.opensourcecobol.libcobj.file.CobolFile;
import jp.osscons.opensourcecobol.libcobj.file.CobolFileFactory;
import jp.osscons.opensourcecobol.libcobj.file.CobolFileKey;
import jp.osscons.opensourcecobol.libcobj.file.CobolIndexedFile;
import org.apache.commons.cli.CommandLine;
import org.apache.commons.cli.CommandLineParser;
import org.apache.commons.cli.DefaultParser;
import org.apache.commons.cli.Options;
import org.apache.commons.cli.ParseException;
import org.sqlite.SQLiteConfig;

/**
 * Main class of the utility tool `cobj-idx` to handle a indexed file of opensource COBOL 4J. This
 * tool is used to show information of the indexed file, load data to the indexed file, and unload
 * data from the indexed file.
 */
class IndexedFileUtilMain {
    private static final String version = jp.osscons.opensourcecobol.libcobj.Const.version;

    /**
     * Main method
     *
     * @param args TODO: 準備中
     */
    public static void main(String[] args) {

        // Build a command line parser
        Options options = new Options();
        options.addOption("h", "help", false, "Print this message.");
        options.addOption("v", "version", false, "Print the version");
        options.addOption("n", "new", false, "Delete all data before loading");
        options.addOption("f", "format", true, "Specify the format of the input and output data");
        CommandLineParser parser = new DefaultParser();
        CommandLine cmd;

        // Parse command line arguments
        try {
            cmd = parser.parse(options, args);
        } catch (ParseException e) {
            printHelpMessage();
            System.exit(1);
            return;
        }

        // Process -h, --help option
        if (cmd.hasOption("h")) {
            printHelpMessage();
            System.exit(0);
            return;
        }

        // Process -v, --version option
        if (cmd.hasOption("v")) {
            System.out.println(version);
            System.exit(0);
            return;
        }

        // Process -f, --format option
        UserDataFormat userDataFormat = UserDataFormat.SEQUENTIAL;
        String userDataFormatString = cmd.getOptionValue("f");
        if (userDataFormatString != null) {
            userDataFormatString = userDataFormatString.toLowerCase();
            if ("txt".equals(userDataFormatString)) {
                userDataFormat = UserDataFormat.LINE_SEQUENTIAL;
            } else if ("bin".equals(userDataFormatString)) {
                userDataFormat = UserDataFormat.SEQUENTIAL;
            } else {
                System.err.println(
                        String.format(
                                "error: '%s' is invalid value of -f and --format option.",
                                userDataFormatString));
                System.err.println(
                        "       possible values of -f and --format option is 'txt' and 'bin'.");
                System.exit(1);
            }
        }

        // If no sub command is specified, print help message and exit.
        String[] unrecognizedArgs = cmd.getArgs();
        if (unrecognizedArgs.length == 0) {
            printHelpMessage();
            System.exit(0);
            return;
        }

        // Dispatch sub commands
        String subCommand = unrecognizedArgs[0];
        if ("info".equals(subCommand)) {
            if (unrecognizedArgs.length != 2) {
                if (unrecognizedArgs.length < 2) {
                    System.err.println("error: no indexed file is specified.");
                } else {
                    System.err.println("error: too many indexed files are specified.");
                }
                System.exit(1);
            }
            String indexedFilePath = args[1];
            int exitCode = processInfoCommand(indexedFilePath);
            System.exit(exitCode);

        } else if ("load".equals(subCommand)) {
            if (unrecognizedArgs.length < 2 || unrecognizedArgs.length > 3) {
                if (unrecognizedArgs.length < 2) {
                    System.err.println("error: no indexed file is specified.");
                } else {
                    System.err.println("error: too many indexed files are specified.");
                }
                System.exit(1);
            }
            String indexedFilePath = unrecognizedArgs[1];
            Optional<String> filePath;
            if (unrecognizedArgs.length == 3) {
                filePath = Optional.of(unrecognizedArgs[2]);
            } else {
                filePath = Optional.empty();
            }
            boolean deleteBeforeLoading = cmd.hasOption("n");
            int exitCode =
                    processLoadCommand(
                            indexedFilePath, deleteBeforeLoading, userDataFormat, filePath);
            System.exit(exitCode);

        } else if ("unload".equals(subCommand)) {
            if (unrecognizedArgs.length < 2 || unrecognizedArgs.length > 3) {
                if (unrecognizedArgs.length < 2) {
                    System.err.println("error: no indexed file is specified.");
                } else {
                    System.err.println("error: too many indexed files are specified.");
                }
                System.exit(1);
            }
            String indexedFilePath = unrecognizedArgs[1];
            Optional<String> filePath;
            if (unrecognizedArgs.length == 3) {
                filePath = Optional.of(unrecognizedArgs[2]);
            } else {
                filePath = Optional.empty();
            }
            int exitCode = processUnloadCommand(indexedFilePath, userDataFormat, filePath);
            System.exit(exitCode);
        } else {
            printHelpMessage();
            System.exit(1);
        }
    }

    /** Print help message. */
    private static void printHelpMessage() {
        System.out.println(
                "cobj-idx - A utility tool to handle an indexed file of opensource COBOL 4J");
        System.out.println();
        System.out.println("Usage:");
        System.out.println("cobj-idx <sub command> [options] <indexed file>");
        System.out.println();
        System.err.println("Sub commands:");
        System.out.println();
        System.out.println("cobj-idx info <indexed-file>");
        System.out.println("    Show information of the indexed file.");
        System.out.println();
        System.out.println("cobj-idx load <indexed file>");
        System.out.println("    Load the data from stdin into the indexed file.");
        System.out.println("    The default format of the input data is SEQUENTIAL of COBOL.");
        System.out.println();
        System.out.println("cobj-idx load <indexed file> <input file>");
        System.out.println("    Load data from the input file into the indexed file.");
        System.out.println("    The default format of the input data is SEQUENTIAL of COBOL.");
        System.out.println();
        System.out.println("cobj-idx unload <indexed file>");
        System.out.println("    Write the records stored in the indexed file into stdout.");
        System.out.println("    The default format of the output data is SEQUENTIAL of COBOL.");
        System.out.println();
        System.out.println("cobj-idx unload <indexed file> <output file>");
        System.out.println(
                "    Write the records stored in the indexed file into the output file.");
        System.out.println("    The default format of the output data is SEQUENTIAL of COBOL.");
        System.out.println();
        System.out.println("Options:");
        System.out.println();
        System.out.println("-f <format>, --format=<format>");
        System.out.println("    Specify the format of the input and output data.");
        System.out.println("    Possible values are 'txt' and the default value 'bin'");
        System.out.println(
                "    'bin' and 'txt' means SEQUENTIAL and LINE SEQUENTIAL respectively.");
        System.out.println(
                "    When doing a `load`, this option specifies the format of input data which will"
                        + " be inserted to an indexed file.");
        System.out.println(
                "    When doing an `unload`, this option specifies the format of output data which"
                        + " will be read from an indexed file.");
        System.out.println();
        System.out.println("-h --help");
        System.out.println("    Print this message.");
        System.out.println();
        System.out.println("-n, --new");
        System.out.println(
                "    Delete all data before inserting new data. This option is only valid when the"
                        + " sub command is 'load'.");
        System.out.println();
        System.out.println("-v, --version");
        System.out.println("    Print the version of cobj-idx.");
    }

    /**
     * Process info sub command, which shows information of the indexed file.
     *
     * @param indexedFilePath TODO: 準備中
     * @return 0 if success, otherwise non-zero. The return value is error code.
     */
    private static int processInfoCommand(String indexedFilePath) {
        File indexedFile = new File(indexedFilePath);
        if (!indexedFile.exists()) {
            return ErrorLib.errorFileDoesNotExist(indexedFilePath);
        }
        if (!indexedFile.isFile()) {
            return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
        }

        SQLiteConfig config = new SQLiteConfig();
        config.setReadOnly(true);
        StringBuilder sb = new StringBuilder();

        try (Connection conn =
                        DriverManager.getConnection(
                                "jdbc:sqlite:" + indexedFilePath, config.toProperties());
                Statement stmt = conn.createStatement(); ) {
            // Retrieve the record size
            ResultSet rs =
                    stmt.executeQuery(
                            "select value from metadata_string_int where key = 'record_size'");
            if (!rs.next()) {
                return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
            }
            int recordSize = rs.getInt("value");
            sb.append("Size of a record: " + recordSize + "\n");

            // Retrieve the number of records
            rs = stmt.executeQuery("select count(*) from table0");
            if (!rs.next()) {
                return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
            }
            sb.append("Number of records: " + rs.getInt(1) + "\n");

            // Retrieve the number of keys
            rs =
                    stmt.executeQuery(
                            "select idx, offset, size, duplicate from metadata_key order by idx");
            while (rs.next()) {
                int idx = rs.getInt("idx");
                int offset = rs.getInt("offset") + 1;
                int size = rs.getInt("size");
                boolean duplicate = rs.getBoolean("duplicate");
                if (idx == 0) {
                    sb.append("Primary key position: ");
                } else {
                    sb.append("Alternate key position ");
                    if (duplicate) {
                        sb.append("(Duplicates): ");
                    } else {
                        sb.append("(No duplicate): ");
                    }
                }
                sb.append(offset + "-" + (offset + size - 1) + "\n");
            }

            System.out.print(sb.toString());
            return 0;
        } catch (SQLException e) {
            return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
        }
    }

    /**
     * Process load sub command, which loads data inputted from stdin to the indexed file.
     *
     * @param indexedFilePath TODO: 準備中
     * @return TODO: 準備中
     */
    private static int processLoadCommand(
            String indexedFilePath,
            boolean deleteBeforeLoading,
            UserDataFormat userDataFormat,
            Optional<String> filePath) {
        File indexedFile = new File(indexedFilePath);
        if (!indexedFile.exists()) {
            return ErrorLib.errorFileDoesNotExist(indexedFilePath);
        }
        if (!indexedFile.isFile()) {
            return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
        }
        Optional<CobolFile> cobolFileRet = createCobolFileFromIndexedFilePath(indexedFilePath);
        if (!cobolFileRet.isPresent()) {
            return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
        }
        CobolIndexedFile cobolIndexedFile = (CobolIndexedFile) cobolFileRet.get();

        // Set the module
        CobolModule module =
                new CobolModule(null, null, null, null, 0, '.', '$', ',', 1, 1, 1, 0, null);
        CobolModule.push(module);

        // Open the indexed file
        CobolRuntimeException.code = 0;
        cobolIndexedFile.setCommitOnModification(false);
        cobolIndexedFile.open(CobolFile.COB_OPEN_EXTEND, 0, null);
        if (CobolRuntimeException.code != 0) {
            return ErrorLib.errorIO();
        }

        if (deleteBeforeLoading) {
            cobolIndexedFile.deleteAllRecords();
        }

        RecordReader reader =
                RecordReader.getInstance(userDataFormat, cobolIndexedFile.record_max, filePath);
        reader.open();
        LoadResult loadResult = LoadResult.LoadResultSuccess;
        // Read records from stdin or a file and write them to the indexed file
        while (true) {
            loadResult = reader.read(cobolIndexedFile.record.getDataStorage());
            if (loadResult != LoadResult.LoadResultSuccess) {
                break;
            }

            // Write the record to the indexed file
            CobolRuntimeException.code = 0;
            try {
                cobolIndexedFile.write(cobolIndexedFile.record, 0, null);
            } catch (CobolStopRunException e) {
                loadResult = LoadResult.LoadResultOther;
                break;
            }
            if (CobolRuntimeException.code != 0) {
                loadResult = LoadResult.LoadResultOther;
                break;
            }
        }

        reader.close();

        if (loadResult == LoadResult.LoadResultDataSizeMismatch) {
            return ErrorLib.errorDataSizeMismatch(cobolIndexedFile.record.getSize());
        } else if (loadResult == LoadResult.LoadResultOther) {
            return ErrorLib.errorDuplicateKeys();
        } else {
            cobolIndexedFile.commitJdbcTransaction();
            cobolIndexedFile.close(0, null);
            return 0;
        }
    }

    /**
     * Process unload sub command, which writes records stored in the indexed file to stdout.
     *
     * @param indexedFilePath The path of the indexed file.
     * @param userDataFormat The format of the output data. If this value is
     *     UserDataFormat.LINE_SEQUENTIAL, each records are separated by a newline character (0x20).
     *     If this value is UserDataFormat.SEQUENTIAL, each records are concatenated without any
     *     separator.
     * @return 0 if success, otherwise non-zero. The return value is error code.
     */
    private static int processUnloadCommand(
            String indexedFilePath, UserDataFormat userDataFormat, Optional<String> filePath) {
        File indexedFile = new File(indexedFilePath);
        if (!indexedFile.exists()) {
            return ErrorLib.errorFileDoesNotExist(indexedFilePath);
        }
        if (!indexedFile.isFile()) {
            return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
        }
        Optional<CobolFile> cobolFileRet = createCobolFileFromIndexedFilePath(indexedFilePath);
        if (!cobolFileRet.isPresent()) {
            return ErrorLib.errorInvalidIndexedFile(indexedFilePath);
        }
        CobolFile cobolFile = cobolFileRet.get();

        // Set the module
        CobolModule module =
                new CobolModule(null, null, null, null, 0, '.', '$', ',', 1, 1, 1, 0, null);
        CobolModule.push(module);

        // Open the indexed file
        CobolRuntimeException.code = 0;
        cobolFile.open(CobolFile.COB_OPEN_INPUT, 0, null);
        if (CobolRuntimeException.code != 0) {
            return ErrorLib.errorIO();
        }

        // Read records from the indexed file and write them to stdout or a file
        boolean isIndexedFileEmpty = true;
        try (OutputStream stream = getOutputStream(filePath)) {
            while (true) {
                CobolRuntimeException.code = 0;
                cobolFile.read(0, null, 1);
                if (CobolRuntimeException.code == 0) {
                    isIndexedFileEmpty = false;
                    CobolDataStorage storage = cobolFile.record.getDataStorage();
                    stream.write(
                            storage.getRefOfData(), storage.getIndex(), cobolFile.record.getSize());
                    if (userDataFormat == UserDataFormat.LINE_SEQUENTIAL) {
                        stream.write('\n');
                    }
                } else if (CobolRuntimeException.code == 0x0501) {
                    break;
                } else {
                    return ErrorLib.errorIO();
                }
            }
            if (userDataFormat == UserDataFormat.SEQUENTIAL && !isIndexedFileEmpty) {
                stream.write('\n');
            }
        } catch (IOException e) {
            return ErrorLib.errorIO();
        }

        cobolFile.close(CobolFile.COB_CLOSE_NORMAL, null);

        CobolModule.pop();
        return 0;
    }

    private static OutputStream getOutputStream(Optional<String> filePath)
            throws FileNotFoundException {
        if (filePath.isPresent()) {
            return new FileOutputStream(filePath.get());
        } else {
            return System.out;
        }
    }

    /**
     * Create a CobolFile instance from the path of the indexed file.
     *
     * @param indexedFilePath TODO: 準備中
     * @return CobolFile instance if success, otherwise empty.
     */
    private static Optional<CobolFile> createCobolFileFromIndexedFilePath(String indexedFilePath) {
        SQLiteConfig config = new SQLiteConfig();
        config.setReadOnly(true);

        try (Connection conn =
                        DriverManager.getConnection(
                                "jdbc:sqlite:" + indexedFilePath, config.toProperties());
                Statement stmt = conn.createStatement(); ) {

            // Retrieve the record size
            ResultSet rs =
                    stmt.executeQuery(
                            "select value from metadata_string_int where key = 'record_size'");
            if (!rs.next()) {
                return Optional.empty();
            }
            int recordSize = rs.getInt("value");

            // Create a record field
            byte[] recordByteArray = new byte[recordSize];
            CobolDataStorage recordDataStorage = new CobolDataStorage(recordByteArray);
            AbstractCobolField recordField =
                    CobolFieldFactory.makeCobolField(
                            recordSize,
                            recordDataStorage,
                            new CobolFieldAttribute(1, 0, 0, 0, null));

            // Retrive key information
            List<CobolFileKey> keyList = new ArrayList<CobolFileKey>();
            rs =
                    stmt.executeQuery(
                            "select idx, offset, size, duplicate from metadata_key order by idx");
            while (rs.next()) {
                int offset = rs.getInt("offset");
                int size = rs.getInt("size");
                boolean duplicate = rs.getBoolean("duplicate");

                CobolFileKey cobolFileKey = new CobolFileKey();
                cobolFileKey.setOffset(offset);
                cobolFileKey.setFlag(duplicate ? 1 : 0);
                AbstractCobolField keyField =
                        CobolFieldFactory.makeCobolField(
                                size,
                                recordDataStorage.getSubDataStorage(offset),
                                new CobolFieldAttribute(33, 0, 0, 0, null));
                cobolFileKey.setField(keyField);

                keyList.add(cobolFileKey);
            }

            // Construct a CobolFile instance
            byte[] fileStatus = new byte[4];
            byte[] indxedFilePathBytes = indexedFilePath.getBytes(AbstractCobolField.charSetSJIS);
            AbstractCobolField assignField =
                    CobolFieldFactory.makeCobolField(
                            indxedFilePathBytes.length,
                            new CobolDataStorage(indxedFilePathBytes),
                            new CobolFieldAttribute(33, 0, 0, 0, null));
            CobolFileKey[] keyArray = new CobolFileKey[keyList.size()];
            keyList.toArray(keyArray);
            CobolFile cobolFile =
                    CobolFileFactory.makeCobolFileInstance(
                            "f",
                            fileStatus,
                            assignField,
                            recordField,
                            null,
                            recordSize,
                            recordSize,
                            keyArray.length,
                            keyArray,
                            (char) 3,
                            (char) 1,
                            (char) 0,
                            (char) 0,
                            false,
                            (char) 0,
                            (char) 0,
                            false,
                            false,
                            false,
                            (char) 0,
                            false,
                            (char) 2,
                            false,
                            false,
                            (char) 0);
            conn.close();
            return Optional.of(cobolFile);
        } catch (SQLException e) {
            return Optional.empty();
        }
    }
}
