// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EduChainRegistry {
    address public owner;
    mapping(address => bool) public issuers;

    struct Student {
        string studentCode;
        address wallet;
        string dataHash;
        string metadataCID;
        string displayName;
        string program;
        uint256 updatedAt;
        bool exists;
    }

    struct Credential {
        bytes32 id;
        bytes32 studentKey;
        address student;
        address issuer;
        string credentialType;
        string title;
        string institution;
        string metadataCID;
        string dataHash;
        uint16 score;
        uint256 issuedAt;
        bool revoked;
        bool exists;
    }

    struct AccessGrant {
        address viewer;
        uint256 expiresAt;
        string purpose;
        bool active;
    }

    mapping(bytes32 => Student) private students;
    mapping(bytes32 => Credential) private credentials;
    mapping(bytes32 => bytes32[]) private credentialsByStudent;
    mapping(bytes32 => mapping(address => AccessGrant)) private accessGrants;

    bytes32[] private studentIds;
    bytes32[] private credentialIds;
    uint256 public grantCount;

    event IssuerUpdated(address indexed issuer, bool active);
    event StudentRegistered(bytes32 indexed studentKey, address indexed wallet, string metadataCID);
    event StudentDataUpdated(bytes32 indexed studentKey, string dataHash, string metadataCID);
    event CredentialIssued(bytes32 indexed credentialId, bytes32 indexed studentKey, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialId, address indexed revokedBy);
    event AccessGranted(bytes32 indexed studentKey, address indexed viewer, uint256 expiresAt, string purpose);
    event AccessRevoked(bytes32 indexed studentKey, address indexed viewer);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyIssuer() {
        require(issuers[msg.sender] || msg.sender == owner, "Only approved issuer");
        _;
    }

    constructor() {
        owner = msg.sender;
        issuers[msg.sender] = true;
        emit IssuerUpdated(msg.sender, true);
    }

    function setIssuer(address issuer, bool active) external onlyOwner {
        require(issuer != address(0), "Zero address");
        issuers[issuer] = active;
        emit IssuerUpdated(issuer, active);
    }

    function registerStudent(
        bytes32 studentKey,
        string calldata studentCode,
        address wallet,
        string calldata dataHash,
        string calldata metadataCID,
        string calldata displayName,
        string calldata program
    ) public onlyIssuer {
        require(studentKey != bytes32(0), "Empty student key");
        require(wallet != address(0), "Zero wallet");

        if (!students[studentKey].exists) {
            studentIds.push(studentKey);
        }

        students[studentKey] = Student({
            studentCode: studentCode,
            wallet: wallet,
            dataHash: dataHash,
            metadataCID: metadataCID,
            displayName: displayName,
            program: program,
            updatedAt: block.timestamp,
            exists: true
        });

        emit StudentRegistered(studentKey, wallet, metadataCID);
        emit StudentDataUpdated(studentKey, dataHash, metadataCID);
    }

    function updateStudentData(
        bytes32 studentKey,
        string calldata dataHash,
        string calldata metadataCID
    ) external {
        Student storage student = students[studentKey];
        require(student.exists, "Student not found");
        require(
            msg.sender == student.wallet || issuers[msg.sender] || msg.sender == owner,
            "No permission"
        );

        student.dataHash = dataHash;
        student.metadataCID = metadataCID;
        student.updatedAt = block.timestamp;

        emit StudentDataUpdated(studentKey, dataHash, metadataCID);
    }

    function issueCredential(
        bytes32 credentialId,
        bytes32 studentKey,
        address studentWallet,
        string memory credentialType,
        string memory title,
        string memory institution,
        string memory metadataCID,
        string memory dataHash,
        uint16 score
    ) public onlyIssuer {
        require(credentialId != bytes32(0), "Empty credential id");
        require(!credentials[credentialId].exists, "Credential exists");
        require(score <= 10000, "Score too high");

        if (!students[studentKey].exists) {
            require(studentWallet != address(0), "Student wallet needed");
            studentIds.push(studentKey);
            students[studentKey] = Student({
                studentCode: "",
                wallet: studentWallet,
                dataHash: "",
                metadataCID: "",
                displayName: "",
                program: "",
                updatedAt: block.timestamp,
                exists: true
            });
        }

        address targetWallet = studentWallet == address(0)
            ? students[studentKey].wallet
            : studentWallet;

        credentials[credentialId] = Credential({
            id: credentialId,
            studentKey: studentKey,
            student: targetWallet,
            issuer: msg.sender,
            credentialType: credentialType,
            title: title,
            institution: institution,
            metadataCID: metadataCID,
            dataHash: dataHash,
            score: score,
            issuedAt: block.timestamp,
            revoked: false,
            exists: true
        });

        credentialIds.push(credentialId);
        credentialsByStudent[studentKey].push(credentialId);

        emit CredentialIssued(credentialId, studentKey, msg.sender);
    }

    function recordCourseResult(
        bytes32 resultId,
        bytes32 studentKey,
        address studentWallet,
        string calldata courseTitle,
        string calldata provider,
        string calldata metadataCID,
        string calldata dataHash,
        uint16 score
    ) external onlyIssuer {
        issueCredential(
            resultId,
            studentKey,
            studentWallet,
            "COURSE_RESULT",
            courseTitle,
            provider,
            metadataCID,
            dataHash,
            score
        );
    }

    function revokeCredential(bytes32 credentialId) external {
        Credential storage credential = credentials[credentialId];
        require(credential.exists, "Credential not found");
        require(msg.sender == credential.issuer || msg.sender == owner, "No permission");
        credential.revoked = true;
        emit CredentialRevoked(credentialId, msg.sender);
    }

    function verifyCredential(bytes32 credentialId)
        external
        view
        returns (
            bool valid,
            address student,
            address issuer,
            string memory credentialType,
            string memory title,
            string memory institution,
            string memory metadataCID,
            string memory dataHash,
            uint16 score,
            uint256 issuedAt,
            bool revoked
        )
    {
        Credential storage credential = credentials[credentialId];
        valid = credential.exists && !credential.revoked;
        return (
            valid,
            credential.student,
            credential.issuer,
            credential.credentialType,
            credential.title,
            credential.institution,
            credential.metadataCID,
            credential.dataHash,
            credential.score,
            credential.issuedAt,
            credential.revoked
        );
    }

    function getCredential(bytes32 credentialId) external view returns (Credential memory) {
        require(credentials[credentialId].exists, "Credential not found");
        return credentials[credentialId];
    }

    function getStudent(bytes32 studentKey) external view returns (Student memory) {
        require(students[studentKey].exists, "Student not found");
        return students[studentKey];
    }

    function getStudentCredentialIds(bytes32 studentKey) external view returns (bytes32[] memory) {
        return credentialsByStudent[studentKey];
    }

    function getCredentialCount() external view returns (uint256) {
        return credentialIds.length;
    }

    function getCredentialIdAt(uint256 index) external view returns (bytes32) {
        require(index < credentialIds.length, "Index out of range");
        return credentialIds[index];
    }

    function getStudentCount() external view returns (uint256) {
        return studentIds.length;
    }

    function grantAccess(
        bytes32 studentKey,
        address viewer,
        uint256 expiresAt,
        string calldata purpose
    ) external {
        Student storage student = students[studentKey];
        require(student.exists, "Student not found");
        require(viewer != address(0), "Zero viewer");
        require(expiresAt > block.timestamp, "Expiry in past");
        require(msg.sender == student.wallet || msg.sender == owner, "No permission");

        bool wasActive = accessGrants[studentKey][viewer].active;
        accessGrants[studentKey][viewer] = AccessGrant({
            viewer: viewer,
            expiresAt: expiresAt,
            purpose: purpose,
            active: true
        });

        if (!wasActive) {
            grantCount += 1;
        }

        emit AccessGranted(studentKey, viewer, expiresAt, purpose);
    }

    function revokeAccess(bytes32 studentKey, address viewer) external {
        Student storage student = students[studentKey];
        require(student.exists, "Student not found");
        require(msg.sender == student.wallet || msg.sender == owner, "No permission");
        require(accessGrants[studentKey][viewer].active, "Grant not active");

        accessGrants[studentKey][viewer].active = false;
        emit AccessRevoked(studentKey, viewer);
    }

    function hasAccess(bytes32 studentKey, address viewer) external view returns (bool) {
        AccessGrant storage grant = accessGrants[studentKey][viewer];
        return grant.active && grant.expiresAt >= block.timestamp;
    }

    function getAccessGrant(bytes32 studentKey, address viewer)
        external
        view
        returns (AccessGrant memory)
    {
        return accessGrants[studentKey][viewer];
    }
}
