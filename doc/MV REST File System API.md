## **Login**
----
  Call the login API to authorize subsequent API functions. The login API may return an authorization token to be used in subsequent calls.

* **URL**

  `/login`

* **Method:**

  `POST`

* **URL Params**
  
  None
   
* **Data Params**

  ```
  {
    "ServerIP": RemoteHost,
    "ServerType": GatewayType,
    "ServerName": ServerName,
    "UserId": UserName,
    "Password": Password,
    "AccountName": Account,
    "AccountPath": AccountPath,
    "AccountPassword": AccountPassword,
    "Client": "vscode.restfs"
  }
  ```

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
```
{
    "token_type": "Bearer",
    "access_token": "eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiIxIn0="
}
```
  If an authorization token is returned, it should be used in subsequent calls in the 'authorization' header.

 
* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Unable to authenticate",
    "code": "1028"
}
```

* **Sample Call:**
```
curl --location --request POST 'http://localhost:3181/mvsvr/restfs/login' \
--header 'Accept: application/json' \
--header 'Content-Type: application/json' \
--data-raw '{
    "ServerName": "@12345",
    "Account": "ACCUTERM8",
    "Client": "vscode.restfs"
}'
```

* **Notes:**

  For MVGateway login parameter details, refer to the mvextensions.mvbasic gateway settings:
[https://github.com/mvextensions/mvbasic/blob/master/doc/Extension%20Guide.md#7-sample-settings-files](https://github.com/mvextensions/mvbasic/blob/master/doc/Extension%20Guide.md#7-sample-settings-files).

  For AccuTerm RestFS Connector, include these properties:
```
{
    "ServerName": <FTSERVER session id>,
    "Account": <account name>,
    "Client": "vscode.restfs"
}
```
  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

  ## **Logout**
----
  Call the logout API to terminate the login session. The logout API must include the authorization token returned by the login API in the authroization header.

* **URL**

  `/logout`

* **Method:**

  `GET`

* **URL Params**
  
  None
   
* **Data Params**
  
  None

* **Success Response:**
  * **Code:** 200 OK

 
* **Sample Call:**
```
curl --location --request GET 'http://localhost:3181/mvsvr/restfs/logout' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiIyIn0='
```

* **Notes:**

  For AccuTerm RestFS Connector, the logout API will end the FTSERVER session.

## **Read Directory**
----
  Call the read directory API to read the contents of a directory.

* **URL**

  `/dir/<account>/<path>/<to>/<folder>`

* **Method:**

  `GET`

* **URL Params**
  
  \<account>
  
  The account where the file is to be read from.
  
  \<path>/\<to>/\<folder>
  
  The location of the directory within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<folder> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file.

  ?attr=<attributes>&max_items=<max items>

  Attributes is a bitmask used to limit the items returned. max_items is the maximum number of items to return.

* **Data Params**

  None

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
```
{
    "items": [
      {
        "id": <file or folder name>,
        "attr": <attributes>,
        "size": <size of file or folder item count>
      }, ...
    ]
}
```
  Each line of the file is returned as an element of the data array.
 
* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "item not found",
    "code": "202"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request GET 'http://localhost:3181/mvsvr/restfs/dir/ACCUTERM8/SAMPLES?attr=32976&max_items=250' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0='
```

* **Notes:**

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Read File**
----
  Call the read file API to read the contents of a file.

* **URL**

  `/file/<account>/<path>/<to>/<file>`

* **Method:**

  `GET`

* **URL Params**
  
  \<account>
  
  The account where the file is to be read from.
  
  \<path>/\<to>/\<file>
  
  The location of the file within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file.
   
* **Data Params**

  None

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
```
{
    "id": <file name>,
    "type": "array",
    "data": [
      <file line 1>,
      <file line 2>, ...
    ]
}
```
  Each line of the file is returned as an element of the data array.
 
* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "item not found",
    "code": "202"
}
```
* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request GET 'http://localhost:3181/mvsvr/restfs/file/ACCUTERM8/SAMPLES/SAMPLES/NOTEPAD' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0='
```

* **Notes:**

  For MultiValue systems, each attribute of an item is returned as an element of the data array. If a line (attribute) contains multi-values, the values are returned in a nested array within the attribute element. If a value contains sub-values, the sub-values are returned in a nested array within the value element. In this way, MV delimiters are never returned directly in the API so the API is agnostic to the delimiter values for any MV platform.

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Update File**
----
  Call the update file API to write the contents of a file.

* **URL**

  `/file/<account>/<path>/<to>/<file>`

* **Method:**

  `PUT`

* **URL Params**
  
  \<account>
  
  The account where the file is to be written to.
  
  \<path>/\<to>/\<file>
  
  The location of the file within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file.
   
* **Data Params**

  ```
  {
    "id": FileName,
    "type": "array",
    "data": [
      <file line 1>,
      <file line 2>, ...
    ]  
  }
  ```
  Each line of the file is sent as an element of the data array.
  
* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
  
  None
 
* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "update failed",
    "code": "261"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request PUT 'http://localhost:3181/mvsvr/restfs/file/ACCUTERM8/SAMPLES/SAMPLES/TESTING' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0=' \
--header 'Content-Type: text/plain' \
--data-raw '{
    "id": "TESTING",
    "type": "array",
    "data": [
        "* A Test",
        "PRINT '\''Testing'\''",
        "END"
    ]
}'
```

* **Notes:**

  For MultiValue systems, each attribute of an item is sent as an element of the data array. If a line (attribute) contains multi-values, the values are sent in a nested array within the attribute element. If a value contains sub-values, the sub-values are sent in a nested array within the value element. In this way, MV delimiters are never sent directly in the API so the API is agnostic to the delimiter values for any MV platform.

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Create File or Directory**
----
  Call the create API to create a new file or directory.

* **URL**

  `/create/<account>/<path>/<to>/<file>`

* **Method:**

  `POST`

* **URL Params**
  
  \<account>
  
  The account where the file is to be written to.
  
  \<path>/\<to>/\<file>
  
  The location of the file or directory within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file. Some servers may not allow creating directories (or new files).

  ?dir=true

  When creating a directory (or folder), specify dir=true in the URL query string.
   
* **Data Params (ignored when creating a directory)**

  ```
  {
    "id": FileName,
    "type": "array",
    "data": [
      <file line 1>,
      <file line 2,> ...
    ]  
  }
  ```
  Each line of the file is sent as an element of the data array.
  
* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
  
  None
 
* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "creating new directories is not supported"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file or directory exists",
    "code": "223"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "update failed",
    "code": "261"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request POST 'http://localhost:3181/mvsvr/restfs/create/ACCUTERM8/SAMPLES/SAMPLES/NEW' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0=' \
--header 'Content-Type: application/json' \
--header 'Content-Type: text/plain' \
--data-raw '{
    "id": "NEW",
    "type": "array",
    "data": [
        "* A New Item",
        "PRINT '\''Hello'\''",
        "END"
    ]
}'
```

* **Notes:**

  For MultiValue systems, each attribute of an item is sent as an element of the data array. If a line (attribute) contains multi-values, the values are sent in a nested array within the attribute element. If a value contains sub-values, the sub-values are sent in a nested array within the value element. In this way, MV delimiters are never sent directly in the API so the API is agnostic to the delimiter values for any MV platform.

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Delete File**
----
  Call the delete file API to delete a file.

* **URL**

  `/file/<account>/<path>/<to>/<file>`

* **Method:**

  `DELETE`

* **URL Params**
  
  \<account>
  
  The account where the file is to be deleted.
  
  \<path>/\<to>/\<file>
  
  The location of the file within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file.
   
* **Data Params**

  None

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
 
  None

* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "item not found",
    "code": "202"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "delete failed due to item lock",
    "code": "235"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request DELETE 'http://localhost:3181/mvsvr/restfs/file/ACCUTERM8/SAMPLES/SAMPLES/NEW' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0='
```

* **Notes:**

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Rename File**
----
  Call the rename file API to rename a file or directory.

* **URL**

  `/rename/<old account>/<old path>/<to>/<file>`

* **Method:**

  `GET`

* **URL Params**
  
  \<old account>
  
  The account where the original file is located.
  
  \<old path>/\<to>/\<file>
  
  The location of the original file within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file.

  ?newname=\<new account>/\<new path>/\<to>/\<file>

  The new account, location and name of the file.
   
* **Data Params**

  None

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
 
  None

* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "item not found",
    "code": "202"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
        "message": "file or directory exists",
    "code": "223"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request GET 'http://localhost:3181/mvsvr/restfs/rename/ACCUTERM8/SAMPLES/SAMPLES/TESTING?newname=ACCUTERM8/SAMPLES/SAMPLES/NEWTEST' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0='
```

* **Notes:**

  For AccuTerm RestFS Connector, rename cannot move files to different directories or accounts. Only the file name (MV item ID) may be renamed.
  
  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Get File Status**
----
  Call the stat API to retreive file attributes.

* **URL**

  `/stat/<account>/<path>/<to>/<file>`

* **Method:**

  `GET`

* **URL Params**
  
  \<account>
  
  The account where the file is located.
  
  \<path>/\<to>/\<file>
  
  The location of the file (or folder) within the account. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV files or items in the MD or VOC of the account, a dictionary file or a data file.
   
* **Data Params**

  None

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
```
{
    "attr": <file attributes>,
    "size": <file size>
}
```
  The file attributes is a bitmask, as defined in **File Attributes** in this document. The size is the approximate file size (different line endings may cause the actual size to be different). For directories, the size is the number of items in the directory, but may be zero if the count is unknown (implementation dependent).
 
* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file name missing",
    "code": "200"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 400 Bad Request
  * **Content:** 
```
{
    "status": 400,
    "message": "item not found",
    "code": "202"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "file not found",
    "code": "201"
}
```

* OR

  * **Code:** 404 Not Found
  * **Content:** 
```
{
    "status": 404,
    "message": "item not found",
    "code": "202"
}
```

* **Sample Call:**

```
curl --location --request GET 'http://localhost:3181/mvsvr/restfs/stat/ACCUTERM8/SAMPLES/SAMPLES/NOTEPAD' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0='
```

* **Notes:**

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Command**
----
  Execute a command on the server.

* **URL**

  `/cmd/<command>/<account>/path>/<to>/<file>`

* **Method:**

  `POST`

* **URL Params**
  
  \<command>
  
  The command to execute. For MVBasic RestFS, supported commands are 'compile' and 'catalog'.
  
  \<account>/\<path>/\<to>/\<file>
  
  The location of the file passed to the command. Note that for MultiValue databases supporting this REST File System API, \<path>/\<to>/\<file> may be mapped to MV items in the MD or VOC of the account, a dictionary file or a data file.
   
* **Data Params**

  ```
  {
    <option name>: <option value>,
    <option name>: <option value>, ...
  }
  ```

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
 
  ```
  {
    "message": <status message>,
    "output": [
      <output line 1>,
      [<output line 2>, <source line number>],
      [<output line 3>, <source line number>, <source column number>],
      ...
    ]
  }
  ```

  The status message is displayed in a message box in the VSCode editor window. Output lines are displayed in the extension's output channel. If a source line number is included, it becomes a clickable link to the line in the source code.

* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* **Sample Call:**

```
curl --location --request POST 'http://localhost:3181/mvsvr/restfs/cmd/compile/ACCUTERM8/SAMPLES/SAMPLES/NOTEPAD' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiI2In0='
```

* **Notes:**

  For MVBasic RestFS, the only supported option is "debug":true to compile the program in debug mode.
  
  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **Call**
----
  Call a subroutine / function on the server.

* **URL**

  `/call/<subroutine>/<account>/path>/<to>/<file>`

* **Method:**

  `POST`

* **URL Params**
  
  <subroutine>
  
  The name of the subroutine to call.
   
* **Data Params**

  ```
  {
    "args": [
      <arg1>,
      <arg2>,
      ...
    ]
  }
  ```

* **Success Response:**
  * **Code:** 200 OK
  * **Content:**
 
  ```
  {
    "result": <result>
  }
  ```

  Or

  ```
  {
    "result": [
      <result1>,
      <result2>,
      ...
    ]
  }
  ```

* **Error Response:**

  * **Code:** 500 Internal Error
  * **Content:**
```
{
    "status": 500,
    "message": "Session is not running FTSERVER program",
    "code": "1027"
}
```

* OR

  * **Code:** 401 Unauthorized
  * **Content:** 
```
{
    "status": 401,
    "message": "Authorization token must be included in the Authorization header"
}
```

* **Sample Call:**

```
curl --location --request POST 'http://localhost:3181/mvsvr/restfs/call/FTFSDBG' \
--header 'Accept: application/json' \
--header 'Authorization: Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0=.eyJzaWQiOiIxIn0=' \
--header 'Content-Type: text/plain' \
--data-raw '{
	"args": [
		"NEWTEST"
	]
}
'
```

* **Notes:**

  Error codes and messages shown here are only examples. Actual codes and message text are an implementation detail.

## **File Attributes**
----
  Several functions require a file attribute bitmask as a parameter, or return a file attribute bitmask. The bits of the attribute bitmask are defined as:
  ```
  export const enum RestFSAttr {
    ATTR_READONLY     = 0x0001, // item is read-only
    ATTR_HIDDEN       = 0x0002, // item is hidden file or folder
    ATTR_SYSTEM       = 0x0004, // item is a system file or folder
    ATTR_VOLUME       = 0x0008, // unused (reserved)
    ATTR_FOLDER       = 0x0010, // item is a "folder" (for MV file, a 'D', 'F' or 'Q' pointer)
    ATTR_ARCHIVE      = 0x0020, // unused (reserved)
    ATTR_SYMLINK      = 0x0040, // item is a symlink (MV 'Q' pointer)
    ATTR_FILE         = 0x0080, // item is normal file (MV item)
    ATTR_FIELD        = 0x0100, // item is a field definition (MV dictionary definition - 'A', 'S', 'I', 'V' or 'D' type)
    ATTR_ACCOUNT      = 0x0200, // item is the account "folder" (MV account MD or VOC)
    ATTR_ROOT         = 0x0400, // item is the root "folder"
    ATTR_DATAONLY     = 0x8000  // when selecting files from MD or VOC, return only data (not dictionary) files
}
```
* **Notes:**

ATTR_DATAONLY is not a true attribute. For MultiValue systems using the AccuTerm RestFS connector, it is used to limit the response from a 'dir' request to items in a data level file. Items in the account (MD or VOC) or a dictionary level file are skipped.

## **Resources**

A Postman collection containing examples for each of the API functions:
[MV REST File System.postman_collection.json](MV%20REST%20File%20System.postman_collection.json)
