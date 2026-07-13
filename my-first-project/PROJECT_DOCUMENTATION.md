# Equipment Maintenance Request System Documentation

## 1. Project Overview

The Equipment Maintenance Request System is a web application for reporting, managing, assigning, and completing equipment maintenance work.

The system uses one login page, then sends each person to a different dashboard based on their role:

- User -> User Dashboard
- Admin -> Admin Dashboard
- Technician -> Technician Dashboard

The project is built with HTML, CSS, JavaScript, Node.js, Express, and MongoDB through Mongoose.

## 2. Main Purpose

The purpose of this project is to make equipment maintenance easier to manage. A user can report damaged or faulty equipment, an admin can approve and assign the work, and a technician can repair the equipment and update the repair status.

## 3. User Roles

### User

The user can:

- Send a maintenance request
- Upload a photo of damaged equipment
- See their own requests
- Check request status
- Receive dashboard notifications
- Update their profile information

The User Dashboard page is:

```text
public/pages/operations.html
```

### Admin

The admin can:

- View all maintenance requests
- Approve requests
- Assign technicians
- Manage equipment
- Manage users
- View reports

The Admin Dashboard page is:

```text
public/pages/admin.html
```

### Technician

The technician can:

- View assigned maintenance requests
- Check problem details
- Update repair progress
- Add repair notes
- Add parts used
- Mark work as completed

The Technician Dashboard page is:

```text
public/pages/technicians.html
```

## 4. Login System

All users log in from one login page:

```text
public/pages/login.html
```

After successful login, the system checks the user's role and redirects them to the correct dashboard.

### Demo Login Accounts

| Role | Username or Email | Password | Dashboard |
| --- | --- | --- | --- |
| User | user or user@minekeeper.com | demo123 | User Dashboard |
| Admin | admin or admin@minekeeper.com | demo123 | Admin Dashboard |
| Technician | technician or technician@minekeeper.com | demo123 | Technician Dashboard |

## 5. Project Structure

```text
my-first-project/
  server.js
  package.json
  database/
    connection.js
    seed.js
  models/
    Equipment.js
    MaintenanceRequest.js
    User.js
  controllers/
    equipmentController.js
    requestController.js
    userController.js
  routes/
    equipmentRoutes.js
    requestRoutes.js
    userRoutes.js
  public/
    css/
      common.css
      dashboard.css
      departments.css
      login.css
    js/
      admin.js
      common.js
      login.js
      operations.js
      technicians.js
    pages/
      admin.html
      login.html
      operations.html
      technicians.html
```

## 6. Database Design

This project uses MongoDB. In MongoDB, data is stored in collections instead of SQL tables.

### Users Collection

Stores login and profile information.

Main fields:

- name
- email
- username
- password
- role
- department
- phone
- status

Allowed roles:

- user
- admin
- technician

### Equipment Collection

Stores equipment information.

Main fields:

- assetId
- name
- type
- location
- status
- lastServiced
- nextService
- assignedTo
- notes

### Maintenance Requests Collection

Stores maintenance request information.

Main fields:

- requestId
- equipment
- type
- dueDate
- priority
- status
- assignedTo
- requesterName
- requesterEmail
- description
- photoName
- partsUsed
- repairSummary
- notes
- completedDate

Request statuses include:

- pending
- approved
- assigned
- inspection
- in-progress
- testing
- completed

## 7. Backend API Routes

### User Routes

Base path:

```text
/users
```

Routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /users | Fetch all users |
| POST | /users/login | Log in user |
| POST | /users/register | Register user |
| PATCH | /users/:id | Update user |

### Request Routes

Base path:

```text
/requests
```

Routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /requests | Fetch maintenance requests |
| POST | /requests | Create a maintenance request |
| GET | /requests/:id | Fetch one request |
| PATCH | /requests/:id | Update request status, assignment, notes, or completion |

Supported filters:

```text
/requests?requesterEmail=user@minekeeper.com
/requests?assignedTo=Technician Name
/requests?status=pending
```

### Equipment Routes

Base path:

```text
/equipment
```

Routes:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | /equipment | Fetch equipment |
| POST | /equipment | Add equipment |
| PATCH | /equipment/:id | Update equipment |

## 8. Main System Flow

### User Flow

1. User logs in.
2. User opens the User Dashboard.
3. User sends a maintenance request.
4. User can add problem details and upload a damaged equipment photo.
5. User can view their own requests and status updates.

### Admin Flow

1. Admin logs in.
2. Admin views all requests.
3. Admin approves a request.
4. Admin assigns the request to a technician.
5. Admin manages users and equipment.
6. Admin views reports.

### Technician Flow

1. Technician logs in.
2. Technician views assigned requests.
3. Technician checks the problem details.
4. Technician updates the repair status.
5. Technician adds repair notes and parts used.
6. Technician marks the work as completed.

## 9. How to Run the Project

1. Open the project folder:

```text
my-first-project
```

2. Install dependencies:

```bash
npm install
```

3. Make sure MongoDB is running locally, or provide a MongoDB connection string.

Default local database:

```text
mongodb://localhost:27017/equipment
```

Optional environment variable:

```text
MONGODB_URI=your_mongodb_connection_string
```

4. Start the server:

```bash
node server.js
```

5. Open the application in the browser:

```text
http://localhost:3000
```

The server redirects the root page to:

```text
http://localhost:3000/pages/login.html
```

## 10. Important Files

### Server

```text
server.js
```

Starts the Express server, connects to the database, serves frontend files, and registers API routes.

### Database Connection

```text
database/connection.js
```

Connects the project to MongoDB and loads seed data when the connection is successful.

### Seed Data

```text
database/seed.js
```

Creates sample users, equipment, and maintenance requests for testing.

### Common Frontend Script

```text
public/js/common.js
```

Handles shared dashboard behavior such as login checking, sidebar navigation, logout, notifications, and formatting.

### Login Script

```text
public/js/login.js
```

Handles login, password visibility, demo account buttons, local session storage, and role-based dashboard redirect.

## 11. Current Limitations

- The damaged equipment photo is saved as a selected photo name and preview in the frontend. Full server-side file upload storage is not included yet.
- Demo passwords are plain text for learning and testing. A production system should hash passwords securely.
- Some profile information is stored in browser local storage. A complete production version should save all profile changes to the database.
- The system can continue with fallback sample data if MongoDB is not connected, but real saving and fetching needs MongoDB.

## 12. Summary

This project provides one login system with three role-based dashboards:

- Users submit and track equipment maintenance requests.
- Admins approve, assign, manage, and report on maintenance work.
- Technicians handle assigned repairs and update completion details.

The frontend forms are connected to backend API routes, and the backend uses MongoDB collections for users, equipment, and maintenance requests.
