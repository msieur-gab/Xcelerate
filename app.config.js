// app.config.js
export const appConfig = {
    app: {
        name: "Data Management System",
        version: "2.0.0",
        description: "Offline-capable data management system",
        themeColor: "#007bff"
    },

    defaultView: "users",

    storage: {
        version: 1.0,
        name: 'AppStorage'
    },

    dataSources: {
        users: {
            file: "../data/users.js",  // Changed path
            exportName: "userData",
            displayName: "Team Members",
            editorTitle: "Add/Edit Team Member",
            primaryKey: "userId",
            displayField: "userName",
            visibleColumns: ["userId", "userName", "email", "department", "role", "status", "availability"],
            columnFormatting: {
                email: "email",
                phone: "phone",
                joinDate: "date",
                availability: "percentage",
                isVerified: "boolean",
                status: "select",
                skillLevel: "select"
            },
            searchableFields: ["userName", "email", "department"],
            filterableFields: ["department", "role", "status", "skillLevel"],
            validation: {
                userName: { required: true, minLength: 2 },
                email: { required: true, type: "email" },
                department: { required: true },
                role: { required: true }
            }
        },
        acquisitions: {
            file: "../data/acquisitions.js",  // Changed path
            exportName: "acquisitionsData",
            displayName: "Acquisition Targets",
            editorTitle: "Add/Edit Acquisition Target",
            primaryKey: "companyId",
            displayField: "companyName",
            visibleColumns: ["companyId", "companyName", "industry", "stage", "valuation", "status", "priority"],
            columnFormatting: {
                valuation: "currency",
                revenueAnnual: "currency",
                growthRate: "percentage",
                foundedYear: "year",
                status: "select",
                priority: "select",
                industry: "tags",
                competition_level: "select"
            },
            searchableFields: ["companyName", "industry", "location"],
            filterableFields: ["stage", "status", "priority", "competition_level"],
            validation: {
                companyName: { required: true, minLength: 2 },
                industry: { required: true },
                stage: { required: true },
                valuation: { required: true, type: "number", min: 0 }
            }
        },
        relations: {
            file: "../data/relations.js",  // Changed path
            exportName: "relationsData",
            displayName: "Deal Assignments",
            editorTitle: "Add/Edit Assignment",
            primaryKey: "relationId",
            visibleColumns: ["relationId", "userId", "companyId", "role", "responsibility", "engagementLevel"],
            columnFormatting: {
                engagementLevel: "percentage",
                lastContact: "date",
                nextMeeting: "date",
                role: "select",
                responsibility: "select",
                dealTeam: "select",
                communicationStatus: "select"
            },
            searchableFields: ["userId", "companyId", "notes"],
            filterableFields: ["role", "responsibility", "dealTeam", "communicationStatus","engagementLevel"],
            validation: {
                userId: { required: true },
                companyId: { required: true },
                role: { required: true },
                responsibility: { required: true }
            }
        }
    },

    relationships: {
        // Add self-references for users and acquisitions
        users: {
            primaryKey: "userId",
            displayField: "userName",
            references: {
                "userId": "users"  // Self-reference to allow clicking on userName
            }
        },
        acquisitions: {
            primaryKey: "companyId",
            displayField: "companyName",
            references: {
                "companyId": "acquisitions"  // Self-reference to allow clicking on companyName
            }
        },
        relations: {
            references: {
                userId: "users",
                companyId: "acquisitions"
            },
            displayField: "relationId"
        }
    },
    
    dashboard: {
        metrics: [
            {
                id: 'total-users',
                type: 'count',
                label: 'Total Team Members',
                sourceId: 'users'
            },
            {
                id: 'total-acquisitions',
                type: 'count',
                label: 'Active Acquisitions',
                sourceId: 'acquisitions'
            },
            {
                id: 'total-valuation',
                type: 'sum',
                label: 'Total Valuation',
                sourceId: 'acquisitions',
                field: 'valuation',
                format: 'currency'
            },
            {
                id: 'avg-engagement',
                type: 'average',
                label: 'Average Engagement',
                sourceId: 'relations',
                field: 'engagementLevel',
                format: 'percentage'
            }
        ],
        charts: [
            {
                id: 'acquisitions-by-stage',
                type: 'pie',
                title: 'Acquisitions by Stage',
                sourceId: 'acquisitions',
                categoryField: 'stage',
                valueField: 'valuation'
            },
            {
                id: 'engagement-by-company',
                type: 'bar',
                title: 'Team Engagement by Company',
                sourceId: 'relations',
                categoryField: 'companyId',
                valueField: 'engagementLevel',
                referenceLookup: {
                    sourceId: 'acquisitions',
                    lookupField: 'companyId',
                    displayField: 'companyName'
                }
            },
            {
                id: 'valuation-growth',
                type: 'line',
                title: 'Valuation Growth',
                sourceId: 'acquisitions',
                timeField: 'foundedYear',
                valueField: 'valuation',
                timePeriod: 'year'
            }
        ]
    }
};