### CSV (26/09)

```shell
node .\CSV_Handlers\uploadCSV_GitHub_101.js
Connected to MongoDB.
App is running.      
Saved user: {
  MemberID: '002',
  Name: 'Eshan Nahar',
  Class: 'SE',
  LastAccessed: null,
  _id: new ObjectId('66f4bee45eb73754b152c915'),
  CertID: 'ACES/2024-25/GIT/SE/002',
  __v: 0
}
CSV processing completed
```

```shell
node .\CSV_Handlers\uploadCSV_Membership.js
Connected to MongoDB
Saved user: Eshan Nahar
CSV processing completed
```

### Tests (26/09)

```shell
npm jest
 PASS  tests/membership.test.js 
 PASS  tests/githubCSV.test.js

Test Suites: 2 passed, 2 total
Tests:       13 passed, 13 total
Snapshots:   0 total
Time:        4.886 s, estimated 5 s
Ran all test suites.
```

The package `mongodb-memory-server` is used for tests. If you don't get an `.exe` (I am on Windows) in `node_modules/cache` for them same then you can try in `beforeAll` in the tests above you can directly do `await mongoose.connect('mongodb://localhost:27017/test');`, assuming you ran `mongod` somewhere else before. This will work (I did get error for `.stop()` but not always)