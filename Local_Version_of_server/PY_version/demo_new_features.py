#!/usr/bin/env python3
"""
demo script to show off the new mcp tools
"""

import asyncio
import sys
import os
from dotenv import load_dotenv

load_dotenv()

# new features import
from enhanced_mcp_server import analyze_drug_market_trends, batch_drug_analysis

# test the market trends tool
async def demo_market_trends():
    """show the market trends analysis tool in action"""
    
    print(" DEMO: Market Trends Analysis Tool")
    print("=" * 50)
    print("Simulating Claude Desktop query: 'Analyze market trends for amoxicillin'")
    print()
    
    try:
        # This is what Claude would call through MCP
        result = await analyze_drug_market_trends("amoxicillin", months_back=12)
        
        print("MCP Tool Response:")
        print("-" * 20)
        
        trend_data = result.get('trend_data', {})
        
        print(f"Drug Analyzed: {result.get('drug_analyzed', 'Unknown')}")
        print(f"Analysis Period: {result.get('analysis_period', 'Unknown')}")
        print(f"Total Shortage Events: {trend_data.get('total_shortage_events', 0)}")
        
        market_insights = trend_data.get('market_insights', {})
        print(f"Risk Level: {market_insights.get('risk_level', 'Unknown')}")
        print(f"Shortage Frequency: {market_insights.get('shortage_frequency', 'Unknown')}")
        print(f"Companies Affected: {market_insights.get('companies_affected', 0)}")
        print(f"Recommendation: {market_insights.get('recommendation', 'No recommendation')}")
        
        status_breakdown = trend_data.get('status_breakdown', {})
        if status_breakdown:
            print(f"Status Breakdown: {status_breakdown}")
        
        print(f"\nClaude would receive this structured data and provide insights to the user")
        
    except Exception as e:
        print(f" Demo failed: {e}")

# for batch analysis. give it a list, see what comes back.
async def demo_batch_analysis():
    """show the batch drug analysis tool in action"""
    
    print(f"\n\n DEMO: Batch Drug Analysis Tool")
    print("=" * 50)
    print("Simulating Claude Desktop query: 'Analyze our ICU formulary for shortage risks'")
    print()
    
    # Simulated ICU formulary
    icu_formulary = [
        "morphine",
        "fentanyl", 
        "propofol",
        "amoxicillin",
        "clindamycin"
    ]
    
    print(f"ICU Formulary to analyze: {', '.join(icu_formulary)}")
    print()
    
    try:
        # This is what Claude would call through MCP
        result = await batch_drug_analysis(icu_formulary, include_trends=False)
        
        print("MCP Tool Response:")
        print("-" * 20)
        
        batch_analysis = result.get('batch_analysis', {})
        summary = batch_analysis.get('batch_summary', {})
        
        print(f"Total Drugs Analyzed: {summary.get('total_drugs_analyzed', 0)}")
        print(f"Drugs with Shortages: {summary.get('drugs_with_shortages', 0)}")
        print(f"Drugs with Recalls: {summary.get('drugs_with_recalls', 0)}")
        print(f"High Risk Drugs: {summary.get('high_risk_drugs', 0)}")
        print(f"Total Shortage Events: {summary.get('total_shortage_events', 0)}")
        
        # Risk assessment
        risk_assessment = batch_analysis.get('risk_assessment', {})
        print(f"\nRisk Assessment:")
        
        high_risk = risk_assessment.get('high_risk', [])
        medium_risk = risk_assessment.get('medium_risk', [])
        low_risk = risk_assessment.get('low_risk', [])
        
        if high_risk:
            print(f" High Risk: {', '.join(high_risk)}")
        if medium_risk:
            print(f" Medium Risk: {', '.join(medium_risk)}")
        if low_risk:
            print(f" Low Risk: {', '.join(low_risk)}")
        
        # Recommendations
        recommendations = batch_analysis.get('formulary_recommendations', [])
        if recommendations:
            print(f"\n Formulary Recommendations:")
            for i, rec in enumerate(recommendations[:3], 1):  # Show top 3
                print(f"   {i}. {rec}")
        
        print(f"\n Claude would use this data to provide actionable recommendations to healthcare teams")
        
    except Exception as e:
        print(f" Demo failed: {e}")

# demo use cases.
async def demo_use_cases():
    """show some real-world-ish use cases for these tools"""
    
    print(f"\n\n PRACTICAL USE CASES")
    print("=" * 40)
    
    use_cases = [
        {
            "title": "Hospital Pharmacy Management",
            "query": "Analyze our emergency department formulary for supply chain risks",
            "tool": "batch_drug_analysis",
            "value": "Identifies high-risk medications before stockouts occur"
        },
        {
            "title": "Procurement Planning", 
            "query": "Show me the shortage trends for insulin over the past year",
            "tool": "analyze_drug_market_trends",
            "value": "Helps predict future shortages and plan inventory"
        },
        {
            "title": "Clinical Decision Support",
            "query": "Which antibiotics in our ICU have the lowest shortage risk?",
            "tool": "batch_drug_analysis + filtering",
            "value": "Guides prescribing decisions during supply constraints"
        },
        {
            "title": "Risk Management",
            "query": "Identify drugs with recurring shortage patterns",
            "tool": "analyze_drug_market_trends",
            "value": "Enables proactive mitigation strategies"
        }
    ]
    
    for i, use_case in enumerate(use_cases, 1):
        print(f"\n{i}. {use_case['title']}")
        print(f"   Query: \"{use_case['query']}\"")
        print(f"   Tool: {use_case['tool']}")
        print(f"   Value: {use_case['value']}")

# simulate how claude desktop calls it
async def demo_integration_examples():
    """show how these tools could fit into a claude chat"""
    
    print(f"\n\n CLAUDE DESKTOP INTEGRATION EXAMPLES")
    print("=" * 50)
    
    conversations = [
        {
            "user": "We're having supply issues in our ICU. Can you help assess our formulary?",
            "claude_process": [
                "1. Uses batch_drug_analysis tool with ICU drug list",
                "2. Identifies high-risk medications", 
                "3. Uses analyze_drug_market_trends for high-risk drugs",
                "4. Provides comprehensive risk assessment with alternatives"
            ],
            "output": "Comprehensive ICU formulary risk report with actionable recommendations"
        },
        {
            "user": "Is amoxicillin a reliable antibiotic for our hospital to stock?",
            "claude_process": [
                "1. Uses analyze_drug_market_trends for amoxicillin",
                "2. Checks historical shortage patterns",
                "3. Assesses current market stability",
                "4. Compares with alternative antibiotics using batch_drug_analysis"
            ],
            "output": "Data-driven recommendation on amoxicillin reliability with alternatives"
        }
    ]
    
    for i, conv in enumerate(conversations, 1):
        print(f"\nExample {i}:")
        print(f"User: \"{conv['user']}\"")
        print(f"Claude's Process:")
        for step in conv['claude_process']:
            print(f"   {step}")
        print(f"Output: {conv['output']}")

# mai to run all demos
async def main():
    """run all the demo stuff above"""
    
    print(" ENHANCED MCP SERVER - NEW FEATURES DEMO")
    print("=" * 60)
    print("Demonstrating advanced analytics capabilities for medication management")
    print()
    
    await demo_market_trends()
    await demo_batch_analysis()
    await demo_use_cases()
    await demo_integration_examples()
    
    print(f"\n" + "=" * 60)
    print(" DEMO COMPLETE!")
    print("=" * 60)

if __name__ == "__main__":
    asyncio.run(main())