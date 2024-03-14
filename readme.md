# HexaPink API Reference

## Tables


| endpoint             | method | body        | description                                                                                                            |
| -------------------- | ------ | ----------- | ---------------------------------------------------------------------------------------------------------------------- |
| `/api/tables/upload` | `POST` | `form-data` | Uploads a csv file to the server and creates a corresponding Table in the database                                     |
| `/api/tables/insert` | `POST` | `json`      | Inserts all rows of an uploaded csv file in the corresponding Table's Records (based on the body's `tableId`)          |
| `/api/tables/list`   | `GET`  | `json`      | Returns the matching Tables (based on the body's `statusList` and `limit`)                                             |
| `/api/tables/read`   | `GET`  | `json`      | Returns all the Records of a specified Table (based on the body's `tableId` and `limit`)                               |
| `/api/tables/schema` | `GET`  | `json`      | Gets the Table's Labels (based on the body's `tableId`)                                                                |
| `/api/tables/link`   | `POST` | `json`      | Links Label  (based on the body's `labelId`) to a new or existing key (based on the body's `newKeyName` or `oldKeyId` and `tableId`) |

## Smart Table
| `/api/tables/create`   | `POST` | `json`    | Creates New SmartTable  (based on the body's `keysList` and `smartTableName`)  |