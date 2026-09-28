"""Payment rail port. Import the factory from app.integrations.payments.factory.

Not re-exported here: eager import created a cycle (client -> schemas ->
package init -> factory -> client).
"""
