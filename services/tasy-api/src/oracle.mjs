import oracledb from "oracledb";

export async function createOraclePool(config) {
  if (config.ORACLE_CLIENT_LIB_DIR) {
    oracledb.initOracleClient({ libDir: config.ORACLE_CLIENT_LIB_DIR });
  }
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  oracledb.autoCommit = false;
  return oracledb.createPool({
    user: config.ORACLE_USER,
    password: config.ORACLE_PASSWORD,
    connectString: config.ORACLE_CONNECT_STRING,
    poolMin: 0,
    poolMax: config.ORACLE_POOL_MAX,
    poolIncrement: 1,
    queueTimeout: 5000,
    queueMax: 30,
    connectTimeout: 10,
    poolTimeout: 60,
  });
}
