# Module Organization Validation Script
# Validates that the module organization fixes are properly implemented

param(
    [switch]$Verbose
)

function Write-Status {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Write-Success {
    param([string]$Message)
    Write-Host "[SUCCESS] $Message" -ForegroundColor Green
}

function Write-Warning {
    param([string]$Message)
    Write-Host "[WARNING] $Message" -ForegroundColor Yellow
}

function Write-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

function Test-WorkspaceStructure {
    Write-Status "Validating workspace structure..."
    
    $requiredDirs = @("common", "ticket_contract", "escrow_contract", "multisig_wallet_contract", "contracts", "test")
    $missingDirs = @()
    
    foreach ($dir in $requiredDirs) {
        if (-not (Test-Path $dir -PathType Container)) {
            $missingDirs += $dir
        }
    }
    
    if ($missingDirs.Count -eq 0) {
        Write-Success "All required directories exist"
        return $true
    } else {
        Write-Error "Missing directories: $($missingDirs -join ', ')"
        return $false
    }
}

function Test-CargoTomls {
    Write-Status "Validating Cargo.toml files..."
    
    $requiredTomls = @("Cargo.toml", "common\Cargo.toml", "ticket_contract\Cargo.toml", "escrow_contract\Cargo.toml", "multisig_wallet_contract\Cargo.toml", "contracts\Cargo.toml", "test\Cargo.toml")
    $missingTomls = @()
    
    foreach ($toml in $requiredTomls) {
        if (-not (Test-Path $toml -PathType Leaf)) {
            $missingTomls += $toml
        }
    }
    
    if ($missingTomls.Count -eq 0) {
        Write-Success "All required Cargo.toml files exist"
        return $true
    } else {
        Write-Error "Missing Cargo.toml files: $($missingTomls -join ', ')"
        return $false
    }
}

function Test-LibFiles {
    Write-Status "Validating lib.rs files..."
    
    $requiredLibs = @("common\src\lib.rs", "ticket_contract\src\lib.rs", "escrow_contract\src\lib.rs", "multisig_wallet_contract\src\lib.rs", "contracts\src\lib.rs", "test\src\lib.rs")
    $missingLibs = @()
    
    foreach ($lib in $requiredLibs) {
        if (-not (Test-Path $lib -PathType Leaf)) {
            $missingLibs += $lib
        }
    }
    
    if ($missingLibs.Count -eq 0) {
        Write-Success "All required lib.rs files exist"
        return $true
    } else {
        Write-Error "Missing lib.rs files: $($missingLibs -join ', ')"
        return $false
    }
}

function Test-WorkspaceMembers {
    Write-Status "Validating workspace members..."
    
    $cargoContent = Get-Content "Cargo.toml" -Raw
    $hasCommon = $cargoContent -match 'common'
    $hasTicket = $cargoContent -match 'ticket_contract'
    $hasEscrow = $cargoContent -match 'escrow_contract'
    $hasMultisig = $cargoContent -match 'multisig_wallet_contract'
    $hasContracts = $cargoContent -match 'contracts'
    $hasTest = $cargoContent -match 'test'
    
    if ($hasCommon -and $hasTicket -and $hasEscrow -and $hasMultisig -and $hasContracts -and $hasTest) {
        Write-Success "Workspace members are correctly configured"
        return $true
    } else {
        Write-Error "Workspace members are not correctly configured"
        Write-Error "Missing: common=$hasCommon, ticket_contract=$hasTicket, escrow_contract=$hasEscrow, multisig_wallet_contract=$hasMultisig, contracts=$hasContracts, test=$hasTest"
        return $false
    }
}

function Test-Dependencies {
    Write-Status "Validating dependency structure..."
    
    $contracts = @("ticket_contract", "escrow_contract", "multisig_wallet_contract")
    
    foreach ($contract in $contracts) {
        $cargoContent = Get-Content "$contract\Cargo.toml" -Raw
        if ($cargoContent -match 'gathera-common') {
            Write-Success "$contract depends on gathera-common"
        } else {
            Write-Error "$contract does not depend on gathera-common"
            return $false
        }
        
        # Check that individual contracts don't depend on each other
        $otherContracts = $contracts | Where-Object { $_ -ne $contract }
        foreach ($otherContract in $otherContracts) {
            if ($cargoContent -match $otherContract) {
                Write-Error "$contract incorrectly depends on $otherContract"
                return $false
            }
        }
    }
    
    # Check that contracts module depends on all individual contracts
    $integrationDeps = @("gathera-common", "ticket_contract", "escrow_contract", "multisig_wallet_contract")
    $contractsCargo = Get-Content "contracts\Cargo.toml" -Raw
    foreach ($dep in $integrationDeps) {
        if ($contractsCargo -match $dep) {
            Write-Success "contracts module depends on $dep"
        } else {
            Write-Error "contracts module does not depend on $dep"
            return $false
        }
    }
    
    return $true
}

function Test-Documentation {
    Write-Status "Validating documentation..."
    
    $docs = @("README.md", "DEPENDENCY_ANALYSIS.md")
    $missingDocs = @()
    
    foreach ($doc in $docs) {
        if (-not (Test-Path $doc -PathType Leaf)) {
            $missingDocs += $doc
        }
    }
    
    if ($missingDocs.Count -eq 0) {
        Write-Success "All required documentation files exist"
        return $true
    } else {
        Write-Error "Missing documentation files: $($missingDocs -join ', ')"
        return $false
    }
}

function Test-ModuleBoundaries {
    Write-Status "Validating module boundaries..."
    
    # Check that gathera-common doesn't depend on other contracts
    $commonCargo = Get-Content "common\Cargo.toml" -Raw
    if ($commonCargo -match 'ticket_contract|escrow_contract|multisig_wallet_contract|contracts') {
        Write-Error "gathera-common has invalid dependencies"
        return $false
    } else {
        Write-Success "gathera-common has no contract dependencies"
    }
    
    return $true
}

# Main validation
function Main {
    Write-Status "Starting module organization validation..."
    
    $validations = @(
        { Test-WorkspaceStructure },
        { Test-CargoTomls },
        { Test-LibFiles },
        { Test-WorkspaceMembers },
        { Test-Dependencies },
        { Test-Documentation },
        { Test-ModuleBoundaries }
    )
    
    $failedValidations = 0
    
    foreach ($validation in $validations) {
        if (-not (& $validation)) {
            $failedValidations++
        }
    }
    
    Write-Host ""
    if ($failedValidations -eq 0) {
        Write-Success "All validations passed! Module organization is correct."
        Write-Status "Issue #316: Missing Module Organization has been resolved."
        return $true
    } else {
        Write-Error "$failedValidations validation(s) failed."
        return $false
    }
}

# Run validation
try {
    $result = Main
    if (-not $result) {
        exit 1
    }
} catch {
    Write-Error "Validation script failed: $_"
    exit 1
}
